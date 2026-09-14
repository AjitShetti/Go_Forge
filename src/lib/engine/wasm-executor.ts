"use client";

import type { EngineCapabilities, ExecResult, ExecStatus, GoExecutor, GoFile, RunOptions } from "./types";

export const DEFAULT_MAX_OUTPUT_BYTES = 1 << 20;
const COMPILE_CAP_MS = 120_000;

type ReadyMsg = { type: "ready"; initMs: number; goVersion: string; packages: string[]; builtinPackages: string[] };
type WorkerResult = {
  status: ExecStatus;
  exitCode: number;
  compileOutput?: string;
  compileMs?: number;
  linkMs?: number;
  runMs?: number;
  engineCrash?: string | null;
  engineError?: string;
};
type WorkerMsg =
  | ReadyMsg
  | { type: "phase"; id: number; phase: "compiling" | "running" }
  | { type: "output"; id: number; fd: 1 | 2; text: string }
  | { type: "output-limit"; id: number }
  | { type: "done"; id: number; result: WorkerResult }
  | { type: "fatal"; id?: number; error: string };

type Pending = {
  onPhase(phase: string): void;
  onOutput(fd: 1 | 2, text: string): void;
  kill(status: ExecStatus): void;
  finish(result: WorkerResult): void;
};

/**
 * GoExecutor backed by public/engine/worker.js: the real Go compiler and linker
 * running as WebAssembly. Limits are enforced here, because a Go busy-loop never
 * yields and can only be stopped by terminating the worker. See docs/execution-engine.md.
 */
export class WasmExecutor implements GoExecutor {
  private worker!: Worker;
  private readyInfo: (ReadyMsg & { coldStartMs: number }) | null = null;
  private readyPromise!: Promise<ReadyMsg & { coldStartMs: number }>;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(
    private baseUrl = "/engine/",
    private maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  ) {
    this.spawn();
  }

  private spawn() {
    const t0 = performance.now();
    this.readyInfo = null;
    this.worker = new Worker(new URL("worker.js", new URL(this.baseUrl, location.href)));
    this.readyPromise = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<WorkerMsg>) => {
        const msg = e.data;
        if (msg.type === "ready") {
          this.readyInfo = { ...msg, coldStartMs: Math.round(performance.now() - t0) };
          resolve(this.readyInfo);
        } else if (msg.type === "fatal" && msg.id === undefined) {
          reject(new Error(msg.error));
        } else if ("id" in msg && msg.id !== undefined) {
          this.dispatch(msg);
        }
      };
      this.worker.onerror = (e) => {
        const error = `engine worker error: ${e.message}`;
        reject(new Error(error));
        for (const p of this.pending.values()) p.finish({ status: "engine_error", exitCode: -1, engineError: error });
      };
    });
    this.readyPromise.catch(() => {});
    this.worker.postMessage({ type: "init" });
  }

  private dispatch(msg: WorkerMsg) {
    if (!("id" in msg) || msg.id === undefined) return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    switch (msg.type) {
      case "phase":
        return p.onPhase(msg.phase);
      case "output":
        return p.onOutput(msg.fd, msg.text);
      case "output-limit":
        return p.kill("output_limit");
      case "done":
        return p.finish(msg.result);
      case "fatal":
        return p.finish({ status: "engine_error", exitCode: -1, engineError: msg.error });
    }
  }

  async ready() {
    const info = await this.readyPromise;
    return { goVersion: info.goVersion, coldStartMs: info.coldStartMs };
  }

  capabilities(): EngineCapabilities {
    if (!this.readyInfo) throw new Error("capabilities() called before ready()");
    return {
      engine: "gc-wasm",
      goVersion: this.readyInfo.goVersion,
      goos: "js",
      goarch: "wasm",
      stdlib: this.readyInfo.packages,
      // Established empirically: docs/execution-engine.md §3–4.
      features: {
        goroutines: true,
        channels: true,
        select: true,
        sync: true,
        context: true,
        generics: true,
        deadlockDetection: true,
        escapeAnalysis: true,
        languageVersion: true,
        parallelism: false,
        raceDetector: false,
        fuzzing: false,
        benchmarkTiming: false,
        netListen: false,
      },
    };
  }

  async run(files: GoFile[], opts: RunOptions): Promise<ExecResult> {
    await this.readyPromise;
    const id = this.nextId++;
    const started = performance.now();
    const stdout: string[] = [];
    const stderr: string[] = [];

    return new Promise<ExecResult>((resolve) => {
      let timer = setTimeout(() => entry.kill("timeout"), COMPILE_CAP_MS);
      const entry: Pending = {
        onPhase: (phase) => {
          if (phase !== "running") return;
          clearTimeout(timer);
          timer = setTimeout(() => entry.kill("timeout"), opts.timeoutMs);
        },
        onOutput: (fd, text) => {
          (fd === 2 ? stderr : stdout).push(text);
          (fd === 2 ? opts.onStderr : opts.onStdout)?.(text);
        },
        kill: (status) => {
          this.worker.terminate();
          const others = [...this.pending.entries()].filter(([otherId]) => otherId !== id);
          entry.finish({ status, exitCode: -1 });
          for (const [, other] of others) other.finish({ status: "engine_error", exitCode: -1, engineError: "engine restarted" });
          this.spawn();
        },
        finish: (result) => {
          if (!this.pending.has(id)) return;
          clearTimeout(timer);
          this.pending.delete(id);
          const compileOutput = result.compileOutput ?? "";
          resolve({
            status: result.status,
            exitCode: result.exitCode,
            stdout: stdout.join(""),
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
      this.pending.set(id, entry);
      this.worker.postMessage({ type: "run", id, files, lang: opts.lang, gcflags: opts.gcflags, maxOutputBytes: this.maxOutputBytes });
    });
  }
}

let shared: WasmExecutor | null = null;

/** One engine per tab: the toolchain is ~100 MB in memory. */
export function getExecutor(): WasmExecutor {
  if (!shared) shared = new WasmExecutor();
  return shared;
}
