// Node counterpart of public/engine/executor.js, for scripts (probes, content
// verification). Same worker protocol, same limits, same result shape.
import { join } from "node:path";
import { Worker } from "node:worker_threads";

const WORKER = join(import.meta.dirname, "engine-node-worker.mjs");

export class NodeExecutor {
  constructor({ maxOutputBytes = 1 << 20 } = {}) {
    this.maxOutputBytes = maxOutputBytes;
    this._nextId = 1;
    this._pending = new Map();
    this._spawn();
  }

  _spawn() {
    const t0 = performance.now();
    this.worker = new Worker(WORKER);
    this._ready = new Promise((resolve, reject) => {
      this.worker.on("message", (msg) => {
        if (msg.type === "ready") return resolve({ ...msg, coldStartMs: Math.round(performance.now() - t0) });
        if (msg.type === "fatal" && msg.id === undefined) return reject(new Error(msg.error));
        this._dispatch(msg);
      });
      this.worker.on("error", reject);
    });
    this.worker.postMessage({ type: "init" });
  }

  _dispatch(msg) {
    const p = this._pending.get(msg.id);
    if (!p) return;
    if (msg.type === "phase") p.onPhase(msg.phase);
    else if (msg.type === "output") p.out[msg.fd].push(msg.text);
    else if (msg.type === "output-limit") p.kill("output_limit");
    else if (msg.type === "done") p.finish(msg.result);
    else if (msg.type === "fatal") p.finish({ status: "engine_error", exitCode: -1, engineError: msg.error });
  }

  ready() {
    return this._ready;
  }

  async run(files, opts) {
    await this._ready;
    const id = this._nextId++;
    const started = performance.now();
    return new Promise((resolve) => {
      let timer = setTimeout(() => entry.kill("timeout"), 120000);
      const entry = {
        out: { 1: [], 2: [] },
        onPhase: (phase) => {
          if (phase === "running") {
            clearTimeout(timer);
            timer = setTimeout(() => entry.kill("timeout"), opts.timeoutMs);
          }
        },
        kill: (status) => {
          this.worker.terminate();
          entry.finish({ status, exitCode: -1 });
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
            stdout: entry.out[1].join(""),
            stderr: result.status === "compile_error" ? compileOutput : entry.out[2].join(""),
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

  close() {
    return this.worker.terminate();
  }
}
