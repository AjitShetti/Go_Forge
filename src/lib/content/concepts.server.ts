// Server-only (reads the filesystem).
//
// The reference side of the site. A lesson deliberately withholds its explanation
// until the learner has committed to a prediction, which means that prose - the best
// writing here - is not on the page for a reader arriving from a search. These pages
// give each concept a home of its own: the same explanation, gathered from every
// lesson that teaches it, readable immediately and linked to the lesson that drills it.
import { loadLessonBundle } from "@/lib/content/load";
import { track } from "@/lib/content/track";
import type { VerifiedOutput } from "@/components/markdown";

export type ConceptLesson = {
  moduleSlug: string;
  lessonSlug: string;
  moduleCode: string;
  moduleTitle: string;
  title: string;
  question: string;
  decode?: string;
  contrast?: string;
  verified: Record<string, VerifiedOutput>;
  goVersion: string;
};

export type Concept = {
  slug: string;
  /** "append-aliasing" → "Append aliasing". */
  title: string;
  moduleCode: string;
  lessons: ConceptLesson[];
};

export const conceptTitle = (slug: string) => slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * Every concept taught by at least one authored lesson, in track order.
 *
 * Memoised for the life of the process: building the 52 reference pages would
 * otherwise re-read all 43 lesson bundles once per page. The content is files on
 * disk fixed at build time, so one read is enough.
 */
let memo: Concept[] | null = null;

export function loadConcepts(): Concept[] {
  if (memo) return memo;
  const byslug = new Map<string, Concept>();

  for (const m of track.modules) {
    for (const l of m.lessons) {
      const bundle = loadLessonBundle(m.slug, l.slug);
      if (!bundle) continue; // not authored yet - nothing to explain
      const entry: ConceptLesson = {
        moduleSlug: m.slug,
        lessonSlug: l.slug,
        moduleCode: m.code,
        moduleTitle: m.title,
        title: bundle.lesson.frontmatter.title,
        question: bundle.lesson.frontmatter.trap.question,
        decode: bundle.lesson.sections.Decode,
        contrast: bundle.lesson.sections["Python/JS contrast"],
        verified: Object.fromEntries(Object.entries(bundle.expected.blocks).map(([id, b]) => [id, b.real])),
        goVersion: bundle.expected.goVersion,
      };
      for (const slug of l.concepts) {
        const existing = byslug.get(slug);
        if (existing) existing.lessons.push(entry);
        else byslug.set(slug, { slug, title: conceptTitle(slug), moduleCode: m.code, lessons: [entry] });
      }
    }
  }

  memo = [...byslug.values()];
  return memo;
}

export function loadConcept(slug: string): Concept | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return loadConcepts().find((c) => c.slug === slug) ?? null;
}
