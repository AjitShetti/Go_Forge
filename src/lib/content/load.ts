// Server-only (reads the filesystem).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLessonMd, type ParsedLesson } from "./lesson";

export type BlockExpectation = {
  mode: string;
  compare: string;
  real: { stdout: string; stderr: string; exitCode: number };
  engine?: { stdout: string; stderr: string; exitCode: number; status: string };
  diverges: boolean;
};

export type LessonExpected = {
  goVersion: string;
  blocks: Record<string, BlockExpectation>;
  rebuild: { expectedStdout: string; lockedLines: number[] };
  challenge: { tests: string[] };
};

/** Everything the lesson player needs. Serializable (passed to a Client Component). */
export type LessonBundle = {
  moduleSlug: string;
  lessonSlug: string;
  lesson: ParsedLesson;
  files: {
    trap: string;
    rebuild: string;
    challengeStarter: string;
    challengeTests: string;
    challengeSolution: string;
  };
  hints: string[];
  expected: LessonExpected;
};

/**
 * Loads a lesson from content/go/<module>/<lesson>. Returns null if not authored.
 * Throws if the lesson exists but was never verified (no expected.json): an
 * unverified lesson must not render (spec §1.6).
 */
export function loadLessonBundle(moduleSlug: string, lessonSlug: string): LessonBundle | null {
  if (!/^[a-z0-9-]+$/.test(moduleSlug) || !/^[a-z0-9-]+$/.test(lessonSlug)) return null;
  const dir = join(process.cwd(), "content", "go", moduleSlug, lessonSlug);
  if (!existsSync(join(dir, "lesson.md"))) return null;
  const read = (...p: string[]) => readFileSync(join(dir, ...p), "utf8");
  if (!existsSync(join(dir, "expected.json"))) {
    throw new Error(`lesson ${moduleSlug}/${lessonSlug} has no expected.json — run the content verifier`);
  }
  const lesson = parseLessonMd(read("lesson.md"));
  return {
    moduleSlug,
    lessonSlug,
    lesson,
    files: {
      trap: read("trap.go"),
      rebuild: read("rebuild.go"),
      challengeStarter: read("challenge", lesson.frontmatter.challenge.entry),
      challengeTests: read("challenge", "challenge_test.go"),
      challengeSolution: read("challenge", "solution.go"),
    },
    hints: JSON.parse(read("hints.json")),
    expected: JSON.parse(read("expected.json")),
  };
}
