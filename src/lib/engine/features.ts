// What the in-browser engine can and can't do, for lesson gating.
// Established empirically: docs/execution-engine.md §3–4. Pure (no DOM), so
// server components, the executor and tests share one list.
import type { EngineFeature } from "./types";

export const ENGINE_FEATURES: Record<EngineFeature, boolean> = {
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
};

/** What each missing feature means for a learner, and what to run instead. */
export const LOCAL_ONLY: Partial<Record<EngineFeature, { label: string; why: string; command: string }>> = {
  parallelism: {
    label: "real parallelism",
    why: "the browser engine runs every goroutine on one thread",
    command: "go run .",
  },
  raceDetector: {
    label: "the race detector",
    why: "-race needs cgo and a native runtime, which the browser engine doesn't have",
    command: "go test -race ./...",
  },
  fuzzing: {
    label: "fuzzing",
    why: "go test -fuzz needs the go command and coverage instrumentation",
    command: "go test -fuzz=FuzzName -fuzztime=30s",
  },
  benchmarkTiming: {
    label: "meaningful benchmark timings",
    why: "the browser engine is single-threaded WebAssembly, so nanoseconds per operation there say nothing about native speed",
    command: "go test -run='^$' -bench=. -benchmem",
  },
  netListen: {
    label: "listening on a network port",
    why: "a browser page can't accept TCP connections",
    command: "go run . then curl localhost:8080",
  },
};

export function isEngineFeature(s: string): s is EngineFeature {
  return Object.hasOwn(ENGINE_FEATURES, s);
}

/** The features a lesson requires that the browser engine doesn't have, in the lesson's order. */
export function localOnlyFeatures(requires: string[]): EngineFeature[] {
  return requires.filter((r): r is EngineFeature => isEngineFeature(r) && !ENGINE_FEATURES[r]);
}
