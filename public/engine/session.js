// Worker-side message protocol, shared by the browser Web Worker (worker.js)
// and the Node worker_threads harness (scripts/engine-node-worker.mjs).
//
// in:  {type:"init", baseUrl?}
//      {type:"run", id, files:[{name,content}], lang?, gcflags?, maxOutputBytes}
// out: {type:"ready", initMs, goVersion, packages, builtinPackages}
//      {type:"phase", id, phase:"compiling"|"running"}
//      {type:"output", id, fd:1|2, text}
//      {type:"output-limit", id}          host must terminate the worker
//      {type:"done", id, result}
//      {type:"fatal", error}

(function (g) {
  "use strict";

  function createSession({ post, fetchFile, loadManifest }) {
    let toolchain = null;
    let queue = Promise.resolve();

    async function init() {
      const manifest = await loadManifest();
      toolchain = new g.GoForgeEngine.Toolchain({ manifest, fetchFile });
      const { initMs } = await toolchain.init();
      post({
        type: "ready",
        initMs,
        goVersion: manifest.goVersion,
        packages: toolchain.packages(),
        builtinPackages: manifest.builtinPackages,
      });
    }

    async function run(msg) {
      const { id } = msg;
      post({ type: "phase", id, phase: "compiling" });
      const built = await toolchain.build(msg.files, { lang: msg.lang, gcflags: msg.gcflags });
      if (!built.ok) {
        post({
          type: "done",
          id,
          result: { status: "compile_error", exitCode: 1, compileOutput: built.diagnostics, compileMs: built.compileMs, linkMs: built.linkMs, runMs: 0 },
        });
        return;
      }

      post({ type: "phase", id, phase: "running" });
      const decoders = { 1: new TextDecoder("utf-8"), 2: new TextDecoder("utf-8") };
      let bytes = 0;
      let limited = false;
      const res = await g.GoForgeEngine.runProgram(built.wasm, {
        onOutput(fd, chunk) {
          if (limited) return;
          bytes += chunk.length;
          if (bytes > msg.maxOutputBytes) {
            limited = true;
            post({ type: "output-limit", id });
            return;
          }
          post({ type: "output", id, fd, text: decoders[fd].decode(chunk, { stream: true }) });
        },
      });
      for (const fd of [1, 2]) {
        const tail = decoders[fd].decode();
        if (tail) post({ type: "output", id, fd, text: tail });
      }
      post({
        type: "done",
        id,
        result: {
          status: res.deadlocked ? "deadlock" : res.exitCode === 0 ? "ok" : "exit",
          exitCode: res.exitCode,
          compileOutput: built.diagnostics, // warnings or -m output even on success
          compileMs: built.compileMs,
          linkMs: built.linkMs,
          runMs: res.runMs,
          engineCrash: res.crash,
        },
      });
    }

    return function onMessage(msg) {
      queue = queue.then(async () => {
        try {
          if (msg.type === "init") await init();
          else if (msg.type === "run") await run(msg);
        } catch (e) {
          post({ type: "fatal", id: msg.id, error: String(e && e.stack ? e.stack : e) });
        }
      });
    };
  }

  g.GoForgeSession = { createSession };
})(globalThis);
