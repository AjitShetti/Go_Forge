// Fast checks for the content pipeline (no Go runs). The full verification,
// which runs every program with real Go and the engine, is
// `node scripts/verify-content.mjs`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { observedOutput, normalizeForCompare, parseLessonMd } from "@/lib/content/lesson";
// @ts-expect-error plain .mjs script without type declarations
import { checkMarkdown, checkTrap, norm } from "../../scripts/verify-content.mjs";

const contentDir = join(process.cwd(), "content", "go");
const track = JSON.parse(readFileSync(join(contentDir, "track.json"), "utf8"));

const authored: { module: string; slug: string; dir: string }[] = [];
for (const m of track.modules) {
  for (const l of m.lessons) {
    const dir = join(contentDir, m.slug, l.slug);
    if (existsSync(join(dir, "lesson.md"))) authored.push({ module: m.slug, slug: l.slug, dir });
  }
}

describe("output normalization", () => {
  it("rewrites Windows-relative paths for any Go file and drops the go test build header", () => {
    const raw = "# prog [prog.test]\r\n.\\challenge.go:4:2: \"fmt\" imported and not used\r\n";
    expect(norm(raw)).toBe('./challenge.go:4:2: "fmt" imported and not used\n');
  });
});

describe("markdown the lesson renderer can't show", () => {
  it("rejects tables and raw HTML outside code, allows both inside code", () => {
    const errs: string[] = [];
    checkMarkdown("| a | b |\n|---|---|\n", errs);
    checkMarkdown("text <div>x</div>\n", errs);
    expect(errs).toHaveLength(2);
    const ok: string[] = [];
    checkMarkdown("```\n| a | b |\n<div>\n```\nUse `<T>` in prose, and `a | b`.\n", ok);
    expect(ok).toEqual([]);
  });
});

describe("trap answer check", () => {
  const fm = { trap: { kind: "choice", choices: ["1", "2"], answer: 0 } };
  const run = (stdout: string, stderr = "", exitCode = 0) => ({ compare: "exact", real: { stdout, stderr, exitCode } });

  it("passes when the chosen answer is the verified output", () => {
    const errs: string[] = [];
    checkTrap(fm, run("1\n"), errs);
    expect(errs).toEqual([]);
  });

  it("fails when the answer is not what Go printed", () => {
    const errs: string[] = [];
    checkTrap(fm, run("2\n"), errs);
    expect(errs.join("\n")).toMatch(/!= verified output/);
  });

  it("fails when two choices would both be correct", () => {
    const errs: string[] = [];
    checkTrap({ trap: { kind: "choice", choices: ["1", "1  "], answer: 0 } }, run("1\n"), errs);
    expect(errs.join("\n")).toMatch(/exactly one trap choice/);
  });

  it("uses the first stderr line for panics, like the lesson player", () => {
    const errs: string[] = [];
    checkTrap({ trap: { kind: "choice", choices: ["x\npanic: boom", "x"], answer: 0 } }, run("x\n", "panic: boom\n\ngoroutine 1 [running]:\n", 2), errs);
    expect(errs).toEqual([]);
  });
});

describe("committed content", () => {
  it("covers every lesson in the track (M0–M12)", () => {
    const all = track.modules.flatMap((m: { slug: string; lessons: { slug: string }[] }) => m.lessons.map((l) => `${m.slug}/${l.slug}`));
    expect(all).toHaveLength(43);
    expect(authored.map((a) => `${a.module}/${a.slug}`).sort()).toEqual([...all].sort());
  });

  for (const { module, slug, dir } of authored) {
    describe(`${module}/${slug}`, () => {
      const lesson = parseLessonMd(readFileSync(join(dir, "lesson.md"), "utf8"));
      const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));

      it("has generated expected.json for every verified program", () => {
        const ids = ["trap", "rebuild", "rebuild-solution", ...lesson.fences.filter((f) => f.lang === "go" && f.meta.verified).map((f) => f.meta.id as string)];
        expect(Object.keys(expected.blocks).sort()).toEqual([...ids].sort());
      });

      it("trap answer matches the recorded real Go output", () => {
        const { trap } = lesson.frontmatter;
        const observed = observedOutput(expected.blocks.trap.real);
        const answer = trap.kind === "choice" ? trap.choices![trap.answer as number] : String(trap.answer);
        expect(normalizeForCompare(answer)).toBe(observed);
      });

      it("challenge: solution passes, starter and every wrong solution fail", () => {
        expect(expected.challenge.solution.passed).toBe(true);
        expect(expected.challenge.starter.passed).toBe(false);
        const wrongFiles = readdirSync(join(dir, "challenge", "wrong")).filter((f) => f.endsWith(".go")).sort();
        expect(Object.keys(expected.challenge.wrong).sort()).toEqual(wrongFiles);
        for (const f of wrongFiles) expect(expected.challenge.wrong[f].passed).toBe(false);
      });

      it("no program diverges from real Go without an Engine note", () => {
        const diverging = Object.values(expected.blocks as Record<string, { diverges: boolean }>).some((b) => b.diverges);
        if (diverging) expect(readFileSync(join(dir, "lesson.md"), "utf8")).toMatch(/^\*\*Engine note:\*\*/m);
      });
    });
  }
});
