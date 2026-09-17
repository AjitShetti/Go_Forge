import { describe, expect, it } from "vitest";
import { DEMO_SCENARIO, DEMO_STEPS } from "@/lib/canvas/demo";
import { parseGraph } from "@/lib/canvas/graph";
import { grade } from "@/lib/grader/grade";

// The home page walkthrough promises a story: a naive sketch fails, each fix
// raises the score, and the last step passes. Pin it to the real grader.
describe("home page canvas walkthrough", () => {
  it("every step's graph is a valid stored graph", () => {
    for (const s of DEMO_STEPS) expect(parseGraph(s.graph).ok, s.key).toBe(true);
  });

  it("scores climb from a failing sketch to a pass", () => {
    const graded = DEMO_STEPS.filter((s) => s.graded).map((s) => {
      const r = grade(s.graph, DEMO_SCENARIO);
      return [s.key, r.score, r.passed, r.violations.length, r.warnings.length];
    });
    expect(graded).toEqual([
      ["grade", 50, false, 3, 1],
      ["scale", 80, false, 1, 1],
      ["cache", 85, false, 1, 0],
      ["replicate", 100, true, 0, 0],
    ]);
  });

  it("the capacity arithmetic shown on the scale step matches the graph", () => {
    const app = DEMO_STEPS.find((s) => s.key === "scale")!.graph.nodes.find((n) => n.id === "app")!;
    expect([app.config.replicas, app.config.qpsIn, DEMO_SCENARIO.scale.peakQps]).toEqual([25, 2000, 40_400]);
  });
});
