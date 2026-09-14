export type GoFile = { name: string; content: string };

export type ExecStatus = "ok" | "exit" | "deadlock" | "compile_error" | "timeout" | "output_limit" | "engine_error";

export type ExecResult = {
  status: ExecStatus;
  /** Program exit code; 1 for compile errors (as `go run`), -1 when killed. */
  exitCode: number;
  stdout: string;
  /** Program stderr, or compiler diagnostics when status is compile_error. */
  stderr: string;
  compileOutput: string;
  compileMs: number | null;
  linkMs: number | null;
  runMs: number | null;
  totalMs: number;
  engineError: string | null;
};

export type RunOptions = {
  /** Wall-clock limit for the run phase (compile has its own cap). */
  timeoutMs: number;
  /** Language version, e.g. "go1.21" — what a go.mod `go` directive would say. */
  lang?: string;
  gcflags?: string[];
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

/** Feature keys lessons may list in `requires`. */
export type EngineFeature =
  | "goroutines"
  | "channels"
  | "select"
  | "sync"
  | "context"
  | "generics"
  | "deadlockDetection"
  | "escapeAnalysis"
  | "languageVersion"
  | "parallelism"
  | "raceDetector"
  | "fuzzing"
  | "benchmarkTiming"
  | "netListen";

export type EngineCapabilities = {
  engine: string;
  goVersion: string;
  goos: string;
  goarch: string;
  stdlib: string[];
  features: Record<EngineFeature, boolean>;
};

export interface GoExecutor {
  ready(): Promise<{ goVersion: string; coldStartMs: number }>;
  run(files: GoFile[], opts: RunOptions): Promise<ExecResult>;
  capabilities(): EngineCapabilities;
}
