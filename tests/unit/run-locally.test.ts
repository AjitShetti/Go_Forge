import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_FEATURES, LOCAL_ONLY, isEngineFeature, localOnlyFeatures } from "@/lib/engine/features";
// @ts-expect-error plain .mjs script without type declarations
import { shapeOf } from "../../scripts/verify-content.mjs";

const root = resolve(import.meta.dirname, "..", "..");
const track = JSON.parse(readFileSync(join(root, "content", "go", "track.json"), "utf8"));

describe("engine features", () => {
  it("every requires in track.json is a known feature", () => {
    for (const m of track.modules) {
      for (const l of m.lessons) {
        for (const r of l.requires) expect(isEngineFeature(r), `${m.slug}/${l.slug} requires ${r}`).toBe(true);
      }
    }
  });

  it("every feature the engine lacks explains itself", () => {
    for (const [f, supported] of Object.entries(ENGINE_FEATURES)) {
      if (!supported) expect(LOCAL_ONLY[f as keyof typeof LOCAL_ONLY], f).toBeDefined();
    }
  });

  it("names exactly the lessons that need a native machine", () => {
    const partlyLocal = track.modules.flatMap((m: { slug: string; lessons: { slug: string; requires: string[] }[] }) =>
      m.lessons.filter((l) => localOnlyFeatures(l.requires).length > 0).map((l) => `${m.slug}/${l.slug}:${localOnlyFeatures(l.requires).join("+")}`),
    );
    expect(partlyLocal).toEqual([
      "m8-concurrency-2/data-races:raceDetector",
      "m10-testing-tooling/benchmarks-fuzzing:benchmarkTiming+fuzzing",
      "m12-capstone/kv-store:raceDetector+netListen",
    ]);
  });
});

describe("shapeOf (compare=shape)", () => {
  it("replaces benchmark numbers and padding, keeps allocations", () => {
    const run1 = "cpu: 12th Gen Intel\nBenchmarkConcat-16    \t163037275\t         6.998 ns/op\t     248 B/op\t       8 allocs/op\nok  \tprog\t2.022s";
    const run2 = "cpu: AMD\nBenchmarkConcat-8 \t 9000000\t       120.5 ns/op\t     248 B/op\t       8 allocs/op\nok  \tprog\t1.1s";
    expect(shapeOf(run1)).toBe("cpu: <this machine>\nBenchmarkConcat-P N N ns/op 248 B/op 8 allocs/op\nok  \tprog\tN.NNNs");
    expect(shapeOf(run2)).toBe(shapeOf(run1));
    expect(shapeOf(run1.replace("8 allocs", "9 allocs"))).not.toBe(shapeOf(run1));
  });

  it("drops fuzz progress, normalizes durations and corpus paths", () => {
    const out = "fuzz: elapsed: 1s, minimizing\n--- FAIL: FuzzX (0.62s)\n    Failing input written to testdata\\fuzz\\FuzzX\\771e938e";
    expect(shapeOf(out)).toBe("--- FAIL: FuzzX (N.NNs)\n    Failing input written to testdata/fuzz/FuzzX/771e938e");
  });
});
