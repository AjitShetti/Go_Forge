import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLessonMd } from "@/lib/content/lesson";
import { cardIdFromSource, gradeCard, lessonCards, OUTCOMES, outcomeOf, pickCard, reviewSource } from "@/lib/review/cards";

const dir = join(process.cwd(), "content", "go", "m3-slices-maps", "nil-maps");
const nilMaps = lessonCards({
  lessonRef: "go/m3-slices-maps/nil-maps",
  lessonTitle: "Reading a nil map is fine, writing panics",
  concepts: ["nil-map"],
  lesson: parseLessonMd(readFileSync(join(dir, "lesson.md"), "utf8")),
  expected: JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")),
  trapCode: readFileSync(join(dir, "trap.go"), "utf8"),
});

describe("outcomeOf", () => {
  it("classifies verified runs", () => {
    expect(outcomeOf({ stdout: "hi\n", stderr: "", exitCode: 0 })).toBe(OUTCOMES[0]);
    expect(outcomeOf({ stdout: "", stderr: "./main.go:8:2: invalid operation\n", exitCode: 1 })).toBe(OUTCOMES[1]);
    expect(outcomeOf({ stdout: "x\n", stderr: "panic: boom\n\ngoroutine 1 [running]:\n", exitCode: 2 })).toBe(OUTCOMES[2]);
    expect(outcomeOf({ stdout: "", stderr: "fatal error: all goroutines are asleep - deadlock!\n", exitCode: 2 })).toBe(OUTCOMES[3]);
    expect(outcomeOf({ stdout: "", stderr: "", exitCode: 3 })).toBeNull();
  });
});

describe("lessonCards (nil-maps, real content)", () => {
  it("builds Decode cards first and the trap last, with answers from expected.json", () => {
    expect(nilMaps.map((c) => c.id)).toEqual([
      "go/m3-slices-maps/nil-maps#nil-slice-vs-nil-map",
      "go/m3-slices-maps/nil-maps#map-is-a-pointer",
      "go/m3-slices-maps/nil-maps#trap",
    ]);
    const [slice, pointer, trap] = nilMaps;
    expect(slice).toMatchObject({ kind: "output", answer: "[1] 0 false 0 true" });
    expect(pointer).toMatchObject({ kind: "output", answer: "map[a:1] 8" });
    expect(trap.kind).toBe("choice");
    expect(trap.answer).toBe("0 0 true\npanic: assignment to entry in nil map");
    expect(trap.choices).toContain(trap.answer);
  });

  it("grades by normalized text, ignoring trailing whitespace", () => {
    expect(gradeCard(nilMaps[1], "map[a:1] 8  \n")).toBe(true);
    expect(gradeCard(nilMaps[1], "map[a:1] 16")).toBe(false);
  });

  it("turns a compile-error program into an outcome question", () => {
    const dir2 = join(process.cwd(), "content", "go", "m2-pointers-stack-heap", "pointer-receivers");
    const cards = lessonCards({
      lessonRef: "go/m2-pointers-stack-heap/pointer-receivers",
      lessonTitle: "t",
      concepts: ["value-semantics", "method-receivers"],
      lesson: parseLessonMd(readFileSync(join(dir2, "lesson.md"), "utf8")),
      expected: JSON.parse(readFileSync(join(dir2, "expected.json"), "utf8")),
      trapCode: "",
    });
    const card = cards.find((c) => c.blockId === "not-addressable")!;
    expect(card).toMatchObject({ kind: "choice", answer: "Does not compile" });
  });

  it("skips compile-only and nondeterministic blocks", () => {
    const load = (m: string, l: string) => {
      const d = join(process.cwd(), "content", "go", m, l);
      return lessonCards({ lessonRef: `go/${m}/${l}`, lessonTitle: "t", concepts: ["c"], lesson: parseLessonMd(readFileSync(join(d, "lesson.md"), "utf8")), expected: JSON.parse(readFileSync(join(d, "expected.json"), "utf8")), trapCode: "" });
    };
    expect(load("m2-pointers-stack-heap", "escape-analysis").map((c) => c.blockId)).not.toContain("escape-m");
    expect(load("m3-slices-maps", "map-order").map((c) => c.blockId)).not.toContain("raw-range");
  });
});

describe("pickCard", () => {
  it("prefers unanswered cards, then the least recently answered", () => {
    expect(pickCard(nilMaps, "nil-map", new Map())?.blockId).toBe("nil-slice-vs-nil-map");
    const answered = new Map([
      ["go/m3-slices-maps/nil-maps#nil-slice-vs-nil-map", 5],
      ["go/m3-slices-maps/nil-maps#map-is-a-pointer", 3],
    ]);
    expect(pickCard(nilMaps, "nil-map", answered)?.blockId).toBe("trap");
    answered.set("go/m3-slices-maps/nil-maps#trap", 9);
    expect(pickCard(nilMaps, "nil-map", answered)?.blockId).toBe("map-is-a-pointer");
    expect(pickCard(nilMaps, "other", answered)).toBeNull();
  });

  it("round-trips card ids through predictions.source", () => {
    const id = "go/m3-slices-maps/nil-maps#map-is-a-pointer";
    expect(cardIdFromSource(reviewSource(id))).toBe(id);
    expect(cardIdFromSource("trap")).toBeNull();
    expect(reviewSource(id)).toMatch(/^review:go\/[a-z0-9-]+\/[a-z0-9-]+#[a-z0-9-]+$/);
  });
});
