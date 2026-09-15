import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHarness, parseTestOutput, testNames } from "@/lib/content/harness";
import { changedLockedLines, normalizeForCompare, observedOutput, parseLessonMd } from "@/lib/content/lesson";
import { nextLesson, track } from "@/lib/content/track";

const lessonDir = join(process.cwd(), "content", "go", "m3-slices-maps", "slice-aliasing");

describe("lesson.md parser", () => {
  it("parses the slice-aliasing lesson", () => {
    const l = parseLessonMd(readFileSync(join(lessonDir, "lesson.md"), "utf8"));
    expect(l.frontmatter.slug).toBe("slice-aliasing");
    expect(Object.keys(l.sections)).toEqual(["Provoke", "Decode", "Python/JS contrast", "Rebuild", "Challenge", "Stretch"]);
    expect(l.fences.filter((f) => f.meta.verified).map((f) => f.meta.id)).toEqual(["same-array", "full-slice-expression"]);
  });

  it("rejects bad frontmatter loudly", () => {
    expect(() => parseLessonMd("no frontmatter")).toThrow(/frontmatter/);
    expect(() => parseLessonMd("---\n{nope}\n---\n")).toThrow(/not valid JSON/);
    const fm = {
      slug: "x", title: "x", concepts: ["c"], requires: [],
      trap: { concept: "c", question: "q", kind: "choice", choices: ["a", "b"], answer: 5 },
      rebuild: { goal: "g" }, challenge: { entry: "starter.go" },
    };
    expect(() => parseLessonMd(`---\n${JSON.stringify(fm)}\n---\n`)).toThrow(/answer must index/);
    expect(() => parseLessonMd(`---\n${JSON.stringify({ ...fm, trap: { ...fm.trap, answer: 0 } })}\n---\n## Intro\nx`)).toThrow(/unknown section/);
  });
});

describe("output comparison", () => {
  it("ignores trailing whitespace and newlines only", () => {
    expect(normalizeForCompare("42 42 \r\n")).toBe("42 42");
    expect(normalizeForCompare("a\n\nb\n")).toBe("a\n\nb");
  });

  it("observed output includes the panic line when the program failed", () => {
    expect(observedOutput({ stdout: "before\n", stderr: "panic: boom\n\ngoroutine 1 [running]:\n", exitCode: 2 })).toBe("before\npanic: boom");
    expect(observedOutput({ stdout: "ok\n", stderr: "warning\n", exitCode: 0 })).toBe("ok");
  });

  it("detects edits to locked lines", () => {
    const orig = "a\nb\nc\nd";
    expect(changedLockedLines(orig, "a\nb\nc\nd", [2, 3])).toEqual([]);
    expect(changedLockedLines(orig, "A\nb  \nc\nd\ne", [2, 3])).toEqual([]);
    expect(changedLockedLines(orig, "a\nx\nb\nc\nd", [2, 3])).toEqual([2, 3]);
  });
});

describe("challenge harness", () => {
  it("finds Test functions and generates a testing.Main harness", () => {
    const src = "package main\nimport \"testing\"\nfunc TestA(t *testing.T) {}\nfunc helper(t *testing.T) {}\nfunc TestB_x(tt *testing.T) {}\nfunc Testlower(t *testing.T) {}\n";
    expect(testNames(src)).toEqual(["TestA", "TestB_x"]);
    const h = buildHarness([src]);
    expect(h).toContain('{Name: "TestA", F: TestA}');
    expect(h).toContain("-test.v");
    expect(() => buildHarness(["package main"])).toThrow(/no Test functions/);
  });

  it("parses verbose output into leaf cases", () => {
    const out = [
      "=== RUN   TestAppendCopy",
      "=== RUN   TestAppendCopy/nil_slice",
      "=== RUN   TestAppendCopy/spare_capacity",
      "    challenge_test.go:30: result shares its backing array with the input",
      "--- FAIL: TestAppendCopy (0.00s)",
      "    --- PASS: TestAppendCopy/nil_slice (0.00s)",
      "    --- FAIL: TestAppendCopy/spare_capacity (0.00s)",
      "=== RUN   TestTwice",
      "--- PASS: TestTwice (0.00s)",
      "FAIL",
    ].join("\n");
    const r = parseTestOutput(out, 1);
    expect(r.cases.map((c) => [c.name, c.status])).toEqual([
      ["TestAppendCopy/nil_slice", "PASS"],
      ["TestAppendCopy/spare_capacity", "FAIL"],
      ["TestTwice", "PASS"],
    ]);
    expect(r.cases[1].output).toEqual(["challenge_test.go:30: result shares its backing array with the input"]);
    expect(r.failedCases).toEqual(["TestAppendCopy/spare_capacity"]);
    expect(r.passed).toBe(false);
    expect(r.incomplete).toBe(false);
  });

  it("a crash mid-run is incomplete, never a pass", () => {
    const r = parseTestOutput("=== RUN   TestA\n", 2);
    expect(r.incomplete).toBe(true);
    expect(r.passed).toBe(false);
    expect(parseTestOutput("", 0).passed).toBe(false);
  });
});

describe("nextLesson", () => {
  it("steps within a module, crosses into the next one, and ends after the capstone", () => {
    expect(nextLesson("m5-interfaces", "nil-interface")?.href).toBe("/track/m5-interfaces/implicit-satisfaction");
    const lastOfM0 = track.modules[0].lessons.at(-1)!.slug;
    expect(nextLesson("m0-compiled", lastOfM0)?.href).toBe(`/track/${track.modules[1].slug}/${track.modules[1].lessons[0].slug}`);
    expect(nextLesson("m12-capstone", "kv-store")).toBeNull();
    expect(nextLesson("m5-interfaces", "nope")).toBeNull();
  });
});
