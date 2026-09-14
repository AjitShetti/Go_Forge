// Go Forge execution engine core: the real Go compiler and linker (cmd/compile,
// cmd/link built for GOOS=js GOARCH=wasm) run inside the page's Web Worker,
// then the linked program runs in a fresh Go instance.
//
// Requires memfs.js and wasm_exec.js to be loaded first. Classic script shared
// by the browser worker (importScripts) and Node scripts (vm.runInThisContext).

(function (g) {
  "use strict";

  const { createMemFS, installFS } = g.GoForgeMemFS;
  const STD_ROOT = "/std";
  const WORK = "/work";

  // --- stdlib pack format ------------------------------------------------------
  // "GFPK" | u32 LE header length | JSON header {files:[{path,offset,size}]} | bytes
  function unpack(buffer) {
    const bytes = new Uint8Array(buffer);
    const magic = String.fromCharCode(...bytes.subarray(0, 4));
    if (magic !== "GFPK") throw new Error("engine: bad stdlib pack");
    const headerLen = new DataView(buffer).getUint32(4, true);
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLen)));
    const base = 8 + headerLen;
    return header.files.map((f) => ({ path: f.path, bytes: bytes.subarray(base + f.offset, base + f.offset + f.size) }));
  }

  // --- import scanning -----------------------------------------------------------
  // Only used to decide which lazy stdlib chunks to fetch. The compiler remains
  // the authority on whether the imports are valid.
  function scanImports(source) {
    const src = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    const found = new Set();
    // Go allows both "interpreted" and `raw` string literals as import paths.
    const lit = /["`]([^"`]+)["`]/g;
    for (const block of src.matchAll(/\bimport\s*\(([\s\S]*?)\)/g)) {
      for (const m of block[1].matchAll(lit)) found.add(m[1]);
    }
    for (const m of src.matchAll(/\bimport\s+(?:[A-Za-z_]\w*\s+|\.\s+)?["`]([^"`]+)["`]/g)) found.add(m[1]);
    return [...found];
  }

  // Packages the runtime needs but user programs must not import directly.
  const FORBIDDEN_IMPORTS = { "syscall/js": "it would give Go code access to the browser worker's JavaScript globals" };

  /** Runs one Go wasm module to completion in a fresh instance on `memfs`. */
  async function runGo(module, { memfs, argv, env, watchdog, onDeadlock }) {
    installFS(memfs);
    const go = new g.Go();
    go.argv = argv;
    go.env = env;
    let exitCode = null;
    go.exit = (code) => (exitCode = code);
    const instance = await WebAssembly.instantiate(module, go.importObject);

    let deadlocked = false;
    let timer = null;
    if (watchdog) {
      // On js/wasm the Go runtime never reports "all goroutines are asleep" on
      // its own, because a JS callback might still wake a goroutine. User code
      // gets no JS callbacks, so once Go has yielded to the event loop with no
      // pending Go timers, nothing can ever wake it: a real deadlock. Resuming
      // with event id 0 makes the runtime run its genuine deadlock check and
      // print the real "fatal error" and goroutine dump (the same mechanism
      // wasm_exec_node.js uses when Node's event loop drains).
      // A busy loop never yields, so this cannot fire for it; the host's
      // wall-clock timeout terminates the worker instead.
      timer = setInterval(() => {
        if (go.exited || go._scheduledTimeouts.size !== 0) return;
        deadlocked = true;
        clearInterval(timer);
        if (onDeadlock) onDeadlock();
        go._pendingEvent = { id: 0 };
        go._resume();
      }, 30);
    }

    let crash = null;
    try {
      await go.run(instance);
    } catch (e) {
      crash = e;
    } finally {
      if (timer) clearInterval(timer);
      // Timers left behind by an exited program would resume a dead instance.
      for (const t of go._scheduledTimeouts.values()) clearTimeout(t);
      go._scheduledTimeouts.clear();
    }
    return { exitCode: exitCode ?? (crash ? 2 : 0), deadlocked, crash };
  }

  class Toolchain {
    /**
     * @param {object} o
     * @param {object} o.manifest        public/engine/gen/manifest.json
     * @param {(file: string) => Promise<ArrayBuffer>} o.fetchFile  loads a file from gen/
     */
    constructor({ manifest, fetchFile }) {
      this.manifest = manifest;
      this.fetchFile = fetchFile;
      this.toolFS = createMemFS({ onWrite: (fd, b) => this._toolOut(fd, b) });
      this.loadedChunks = new Set();
      this.modules = {};
      this._toolSink = null;
    }

    _toolOut(fd, bytes) {
      if (this._toolSink) this._toolSink.push(bytes);
    }

    async init() {
      const t0 = performance.now();
      const [compile, link] = await Promise.all([
        this.fetchFile(this.manifest.tools.compile.file).then((b) => WebAssembly.compile(b)),
        this.fetchFile(this.manifest.tools.link.file).then((b) => WebAssembly.compile(b)),
        this.loadChunk("core"),
      ]);
      this.modules.compile = compile;
      this.modules.link = link;
      this.toolFS.mkdirp("/tmp");
      return { initMs: Math.round(performance.now() - t0) };
    }

    async loadChunk(name) {
      if (this.loadedChunks.has(name)) return;
      const chunk = this.manifest.chunks[name];
      if (!chunk) throw new Error(`engine: unknown stdlib chunk ${name}`);
      this.loadedChunks.add(name);
      try {
        await Promise.all(chunk.requires.map((r) => this.loadChunk(r)));
        for (const f of unpack(await this.fetchFile(chunk.file))) this.toolFS.writeFile(`${STD_ROOT}/${f.path}`, f.bytes);
      } catch (e) {
        this.loadedChunks.delete(name);
        throw e;
      }
      this._writeImportcfg();
    }

    _writeImportcfg() {
      const lines = [];
      for (const [pkg, chunk] of Object.entries(this.manifest.packages)) {
        if (this.loadedChunks.has(chunk)) lines.push(`packagefile ${pkg}=${STD_ROOT}/${pkg}.a`);
      }
      this.toolFS.writeFile(`${STD_ROOT}/importcfg`, lines.join("\n") + "\n");
    }

    /** Which stdlib packages are importable (all chunks, loaded lazily). */
    packages() {
      return Object.keys(this.manifest.packages).filter((p) => !p.includes("internal") && !p.startsWith("vendor/"));
    }

    async _tool(name, args) {
      const sink = [];
      this._toolSink = sink;
      const t0 = performance.now();
      const res = await runGo(this.modules[name], {
        memfs: this.toolFS,
        argv: [name, ...args],
        env: { GOROOT: "/goroot", GOOS: "js", GOARCH: "wasm", HOME: "/tmp", TMPDIR: "/tmp" },
      });
      this._toolSink = null;
      const out = new TextDecoder().decode(concat(sink));
      return { ...res, output: out, ms: Math.round(performance.now() - t0) };
    }

    /**
     * Compile and link.
     * @param {{name: string, content: string}[]} files  package main sources
     * @param {{lang?: string, gcflags?: string[]}} opts  lang like "go1.21" (the go.mod go directive)
     * @returns {Promise<{ok: boolean, wasm?: Uint8Array, diagnostics: string, compileMs: number, linkMs: number}>}
     */
    async build(files, opts = {}) {
      const imports = new Set(files.flatMap((f) => scanImports(f.content)));
      for (const imp of imports) {
        if (FORBIDDEN_IMPORTS[imp]) {
          return { ok: false, diagnostics: `engine: import "${imp}" is not allowed: ${FORBIDDEN_IMPORTS[imp]}\n`, compileMs: 0, linkMs: 0 };
        }
      }
      const needed = new Set();
      for (const imp of imports) {
        const chunk = this.manifest.packages[imp];
        if (chunk) needed.add(chunk);
      }
      await Promise.all([...needed].map((c) => this.loadChunk(c)));

      this.toolFS.removeTree(WORK);
      this.toolFS.mkdirp(WORK);
      this.toolFS.chdir(WORK);
      for (const f of files) {
        if (!/^[\w.-]+\.go$/.test(f.name)) throw new Error(`engine: invalid file name ${f.name}`);
        this.toolFS.writeFile(`${WORK}/${f.name}`, f.content);
      }

      const lang = opts.lang ?? this.manifest.goVersion.split(".").slice(0, 2).join(".");
      const compile = await this._tool("compile", [
        "-o", `${WORK}/_main.a`, "-p", "main", `-lang=${lang}`, "-complete", "-dwarf=false",
        "-goversion", this.manifest.goVersion, "-c=1", "-nolocalimports",
        "-importcfg", `${STD_ROOT}/importcfg`, "-trimpath", `${WORK}=>`,
        ...(opts.gcflags ?? []),
        "-pack", ...files.map((f) => f.name),
      ]);
      const diagnostics = rewriteDiagnostics(compile.output, this.manifest, this.loadedChunks);
      if (compile.exitCode !== 0) {
        return { ok: false, diagnostics, compileMs: compile.ms, linkMs: 0 };
      }
      const link = await this._tool("link", [
        "-o", `${WORK}/_main.wasm`, "-importcfg", `${STD_ROOT}/importcfg`, "-buildmode=exe", "-s", "-w", `${WORK}/_main.a`,
      ]);
      if (link.exitCode !== 0) {
        return { ok: false, diagnostics: diagnostics + link.output, compileMs: compile.ms, linkMs: link.ms };
      }
      return { ok: true, wasm: this.toolFS.readFile(`${WORK}/_main.wasm`).slice(), diagnostics, compileMs: compile.ms, linkMs: link.ms };
    }
  }

  function concat(chunks) {
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }

  // Matches `go build`: file positions are reported as ./main.go:L:C.
  function rewriteDiagnostics(text, manifest, loaded) {
    return text
      .split("\n")
      .map((line) => {
        let l = line.replace(/^([\w.-]+\.go):(\d+)/, "./$1:$2");
        const miss = l.match(/could not import ([^\s]+)|package ([^\s]+) is not in std/);
        const pkg = miss && (miss[1] || miss[2]);
        if (pkg && !manifest.packages[pkg]) l += `  [engine: "${pkg}" is not bundled in the browser engine]`;
        return l;
      })
      .join("\n");
  }

  /**
   * Runs a linked program. stdout/stderr are streamed through onOutput as raw
   * bytes (fd 1 or 2) so the host can enforce output caps while it runs.
   */
  async function runProgram(wasmBytes, { onOutput, args = [] } = {}) {
    // After a deadlock is detected, the runtime's dump also lists the goroutine
    // that the event-id-0 resume itself runs in (syscall/js.handleEvent). It is
    // an artifact of how we trigger the check, not part of the user's program,
    // so stderr is held back from that point and that one block is removed.
    let held = null;
    const memfs = createMemFS({
      onWrite: (fd, bytes) => {
        if (held && fd === 2) held.push(bytes);
        else if (onOutput) onOutput(fd, bytes);
      },
    });
    memfs.mkdirp("/tmp");
    memfs.mkdirp("/home/gopher");
    memfs.chdir("/home/gopher");
    const t0 = performance.now();
    const module = await WebAssembly.compile(wasmBytes);
    const res = await runGo(module, {
      memfs,
      argv: ["main", ...args],
      env: { HOME: "/home/gopher", TMPDIR: "/tmp" },
      watchdog: true,
      onDeadlock: () => (held = []),
    });
    if (held && onOutput) {
      const text = new TextDecoder().decode(concat(held));
      const blocks = text.split("\n\n");
      const kept = blocks.filter((b) => !/^goroutine \d+ \[[^\]]*\]:\nsyscall\/js\.handleEvent\(\)/.test(b));
      let out = kept.join("\n\n");
      if (text.endsWith("\n") && !out.endsWith("\n")) out += "\n";
      onOutput(2, new TextEncoder().encode(out));
    }
    if (res.crash && onOutput) {
      // The JS host itself failed (e.g. V8's wasm call-stack limit on very deep
      // recursion). This is NOT Go output; label it so nobody mistakes it for one.
      const msg = String(res.crash);
      const hint = /Maximum call stack size exceeded/.test(msg)
        ? " The browser's WebAssembly call stack ran out before Go's own 1 GB goroutine stack limit. Native Go would print \"fatal error: stack overflow\" (or succeed, if the recursion is finite)."
        : "";
      onOutput(2, new TextEncoder().encode(`[engine] program aborted by the JavaScript host: ${msg}.${hint}\n`));
    }
    return { exitCode: res.exitCode, deadlocked: res.deadlocked, crash: res.crash ? String(res.crash) : null, runMs: Math.round(performance.now() - t0) };
  }

  g.GoForgeEngine = { Toolchain, runProgram, scanImports, unpack };
})(globalThis);
