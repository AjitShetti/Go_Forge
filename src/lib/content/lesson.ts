// Lesson format (content/go/<module>/<lesson>/lesson.md), shared by the app,
// Node scripts and the content verifier. Pure: no fs, no React. Erasable
// TypeScript only, so Node can import it directly (type stripping).
//
// lesson.md = "---" JSON frontmatter "---" + body split into "## Section" blocks.

export const SECTION_NAMES = ["Provoke", "Decode", "Python/JS contrast", "Rebuild", "Challenge", "Stretch"] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

export type TrapSpec = {
  concept: string;
  question: string;
  kind: "choice" | "text";
  choices?: string[];
  /** choice: index into choices; text: the expected output. Verified against real Go. */
  answer: number | string;
};

export type LessonFrontmatter = {
  slug: string;
  title: string;
  concepts: string[];
  requires: string[];
  trap: TrapSpec;
  rebuild: { goal: string; lockedLines?: number[]; expectedStdout?: string };
  challenge: { entry: string; prompt?: string };
  /** go.mod `go` directive the lesson's programs run under, e.g. "go1.21". */
  lang?: string;
};

export type Fence = { lang: string; meta: Record<string, string | true>; code: string };

export type ParsedLesson = {
  frontmatter: LessonFrontmatter;
  sections: Partial<Record<SectionName, string>>;
  fences: Fence[];
};

export function parseFenceInfo(info: string): { lang: string; meta: Record<string, string | true> } {
  const [lang = "", ...rest] = info.trim().split(/\s+/);
  const meta: Record<string, string | true> = {};
  for (const token of rest) {
    const eq = token.indexOf("=");
    if (eq === -1) meta[token] = true;
    else meta[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return { lang, meta };
}

export function parseLessonMd(source: string): ParsedLesson {
  const text = source.replace(/\r\n/g, "\n");
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error("lesson.md: missing --- JSON frontmatter ---");
  let frontmatter: LessonFrontmatter;
  try {
    frontmatter = JSON.parse(fm[1]);
  } catch (e) {
    throw new Error(`lesson.md: frontmatter is not valid JSON: ${(e as Error).message}`);
  }
  validateFrontmatter(frontmatter);

  const body = text.slice(fm[0].length);
  const sections: Partial<Record<SectionName, string>> = {};
  const parts = body.split(/^## (.+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i].trim();
    if (!(SECTION_NAMES as readonly string[]).includes(name)) throw new Error(`lesson.md: unknown section "## ${name}"`);
    sections[name as SectionName] = parts[i + 1].trim();
  }

  const fences: Fence[] = [];
  for (const m of body.matchAll(/^```([^\n]*)\n([\s\S]*?)^```$/gm)) {
    const { lang, meta } = parseFenceInfo(m[1]);
    fences.push({ lang, meta, code: m[2] });
  }
  return { frontmatter, sections, fences };
}

function validateFrontmatter(f: LessonFrontmatter) {
  const need = (cond: unknown, what: string) => {
    if (!cond) throw new Error(`lesson.md frontmatter: ${what}`);
  };
  need(typeof f.slug === "string" && f.slug, "slug required");
  need(typeof f.title === "string" && f.title, "title required");
  need(Array.isArray(f.concepts) && f.concepts.length > 0, "concepts[] required");
  need(Array.isArray(f.requires), "requires[] required");
  need(f.trap && typeof f.trap.question === "string", "trap.question required");
  need(f.trap.kind === "choice" || f.trap.kind === "text", 'trap.kind must be "choice" or "text"');
  if (f.trap.kind === "choice") {
    need(Array.isArray(f.trap.choices) && f.trap.choices.length >= 2, "trap.choices needs at least 2 options");
    need(Number.isInteger(f.trap.answer) && (f.trap.answer as number) >= 0 && (f.trap.answer as number) < f.trap.choices!.length, "trap.answer must index trap.choices");
  }
  need(f.concepts.includes(f.trap.concept), "trap.concept must be one of concepts[]");
  need(f.rebuild && typeof f.rebuild.goal === "string", "rebuild.goal required");
  need(f.challenge && typeof f.challenge.entry === "string", "challenge.entry required");
}

// ------------------------------------------------------------ comparisons ---

/** Output comparison used for predictions and goals: CRLF, trailing spaces and trailing newlines are ignored. */
export function normalizeForCompare(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

/** What the learner is predicting: stdout, plus the first stderr line when the program failed (a panic message). */
export function observedOutput(r: { stdout: string; stderr: string; exitCode: number }): string {
  const firstErr = r.stderr.split("\n").find((l) => l.trim() !== "") ?? "";
  if (r.exitCode === 0 || !firstErr) return normalizeForCompare(r.stdout);
  const out = normalizeForCompare(r.stdout);
  return normalizeForCompare(out === "" ? firstErr : `${out}\n${firstErr}`);
}

export function predictionMatches(trap: TrapSpec, prediction: string, observed: string): boolean {
  return normalizeForCompare(prediction) === normalizeForCompare(observed);
}

/** Lines (1-based) of `original` that were changed in `edited`; compares line N to line N after trimming trailing whitespace. */
export function changedLockedLines(original: string, edited: string, locked: number[] = []): number[] {
  const a = original.replace(/\r\n/g, "\n").split("\n");
  const b = edited.replace(/\r\n/g, "\n").split("\n");
  return locked.filter((n) => (a[n - 1] ?? "").replace(/\s+$/, "") !== (b[n - 1] ?? "").replace(/\s+$/, ""));
}
