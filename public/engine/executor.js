// Main-thread GoExecutor implementation backed by the engine Web Worker.
//
//   const ex = new WasmExecutor({ baseUrl: "/engine/" });
//   await ex.ready();
//   const r = await ex.run([{ name: "main.go", content: src }], { timeoutMs: 5000 });
//
// Hard limits live here, not in the worker: a Go busy-loop never yields, so the
// only way to stop it is worker.terminate(). After a terminate the worker is
// respawned; the toolchain files come back from the HTTP cache.

export const DEFAULT_MAX_OUTPUT_BYTES = 1 << 20;

/** Static facts about this engine, established empirically in docs/execution-engine.md. */
function capabilitiesFor(ready) {
  return {
    engine: "gc-wasm",
    goVersion: ready.goVersion,
    goos: "js",
    goarch: "wasm",
    stdlib: ready.packages,
    builtinPackages: ready.builtinPackages,
    features: {
      goroutines: true, // real Go runtime scheduler, one OS thread
      channels: true,
      select: true,
      sync: true,
      context: true,
      generics: true, // it is the real compiler
      deadlockDetection: true,
      escapeAnalysis: true, // compile with gcflags ["-m"]
      languageVersion: true, // per-program -lang, e.g. go1.21 vs go1.22 loopvar semantics
      parallelism: false, // GOMAXPROCS=1, NumCPU=1: no true parallel speedups
      raceDetector: false, // -race is unsupported on js/wasm
      fuzzing: false,
      benchmarkTiming: false, // testing.Benchmark runs, but wasm timings are not native timings
      netListen: false, // no sockets in a browser; httptest handlers work
      filesystem: "in-memory, per run",
    },
  };
}

export class WasmExecutor {
  constructor({ baseUrl = "/engine/", maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES } = {}) {
    this.baseUrl = baseUrl;
    this.maxOutputBytes = maxOutputBytes;
    this._nextId = 1;
    this._pending = new Map();
    this._spawn();
  }

  _spawn() {
    const t0 = performance.now();
    this.worker = new Worker(new URL("worker.js", new URL(this.baseUrl, location.href)));
    this._readyInfo = null;
    this._ready = new Promise((resolve, reject) => {
      this._resolveReady = resolve;
      this._rejectReady = reject;
    });
    this.worker.onmessage = (e) => this._onMessage(e.data, t0);
    this.worker.onerror = (e) => {
      const err = new Error(`engine worker error: ${e.message}`);
      this._rejectReady(err);
      for (const p of this._pending.values()) p.finish({ status: "engine_error", exitCode: -1, engineError: err.message });
    };
    this.worker.postMessage({ type: "init" });
  }

  _onMessage(msg, t0) {
    if (msg.type === "ready") {
      this._readyInfo = { ...msg, coldStartMs: Math.round(performance.now() - t0) };
      this._resolveReady(this._readyInfo);
      return;
    }
    if (msg.type === "fatal" && msg.id === undefined) {
      this._rejectReady(new Error(msg.error));
      return;
    }
    const p = this._pending.get(msg.id);
    if (!p) return;
    switch (msg.type) {
      case "phase":
        p.onPhase(msg.phase);
        break;
      case "output":
        p.onOutput(msg.fd, msg.text);
        break;
      case "output-limit":
        p.kill("output_limit");
        break;
      case "done":
        p.finish(msg.result);
        break;
      case "fatal":
        p.finish({ status: "engine_error", exitCode: -1, engineError: msg.error });
        break;
    }
  }

  /** Resolves when the toolchain is loaded. Includes coldStartMs. */
  ready() {
    return this._ready;
  }

  capabilities() {
    if (!this._readyInfo) throw new Error("capabilities() called before ready()");
    return capabilitiesFor(this._readyInfo);
  }

  /**
   * @param {{name:string, content:string}[]} files
   * @param {{timeoutMs:number, lang?:string, gcflags?:string[], onStdout?:(s:string)=>void, onStderr?:(s:string)=>void}} opts
   *   timeoutMs bounds the RUN phase only; compiling has its own generous cap.
   */
  async run(files, opts) {
    await this._ready;
    const id = this._nextId++;
    const started = performance.now();
    const stdout = [];
    const stderr = [];

    return new Promise((resolve) => {
      let timer = setTimeout(() => entry.kill("timeout"), 120000); // compile+link safety cap
      const entry = {
        onPhase: (phase) => {
          if (phase === "running") {
            clearTimeout(timer);
            timer = setTimeout(() => entry.kill("timeout"), opts.timeoutMs);
          }
        },
        onOutput: (fd, text) => {
          (fd === 2 ? stderr : stdout).push(text);
          (fd === 2 ? opts.onStderr : opts.onStdout)?.(text);
        },
        kill: (status) => {
          this.worker.terminate();
          entry.finish({ status, exitCode: -1 });
          for (const [otherId, other] of this._pending) {
            if (otherId !== id) other.finish({ status: "engine_error", exitCode: -1, engineError: "engine restarted" });
          }
          this._spawn();
        },
        finish: (result) => {
          if (!this._pending.has(id)) return;
          clearTimeout(timer);
          this._pending.delete(id);
          const compileOutput = result.compileOutput ?? "";
          resolve({
            status: result.status,
            exitCode: result.exitCode,
            stdout: stdout.join(""),
            // A compile error is reported on stderr, exactly where `go run` puts it.
            stderr: result.status === "compile_error" ? compileOutput : stderr.join(""),
            compileOutput,
            compileMs: result.compileMs ?? null,
            linkMs: result.linkMs ?? null,
            runMs: result.runMs ?? null,
            totalMs: Math.round(performance.now() - started),
            engineError: result.engineError ?? result.engineCrash ?? null,
          });
        },
      };
      this._pending.set(id, entry);
      this.worker.postMessage({ type: "run", id, files, lang: opts.lang, gcflags: opts.gcflags, maxOutputBytes: this.maxOutputBytes });
    });
  }
}
