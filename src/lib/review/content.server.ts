// Server-only (reads the filesystem). Review cards and concept → lesson maps
// for every authored lesson.
import { loadLessonBundle } from "@/lib/content/load";
import { contentRef, track } from "@/lib/content/track";
import { lessonCards, type ReviewCard } from "./cards";

export type ConceptInfo = {
  slug: string;
  title: string;
  /** Module code where the concept first appears, e.g. "M3". */
  moduleCode: string;
  /** content_refs of every lesson tagged with the concept, authored or not. */
  lessons: string[];
};

export type LessonInfo = { ref: string; moduleSlug: string; lessonSlug: string; moduleCode: string; title: string; authored: boolean };

export type ReviewContent = {
  cards: ReviewCard[];
  concepts: ConceptInfo[];
  lessons: LessonInfo[];
  goVersion: string | null;
};

export const conceptTitle = (slug: string) => slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

export function loadReviewContent(): ReviewContent {
  const cards: ReviewCard[] = [];
  const concepts = new Map<string, ConceptInfo>();
  const lessons: LessonInfo[] = [];
  let goVersion: string | null = null;

  for (const m of track.modules) {
    for (const l of m.lessons) {
      const ref = contentRef(m.slug, l.slug);
      const bundle = loadLessonBundle(m.slug, l.slug);
      lessons.push({ ref, moduleSlug: m.slug, lessonSlug: l.slug, moduleCode: m.code, title: l.title, authored: bundle !== null });
      for (const c of l.concepts) {
        const info = concepts.get(c) ?? { slug: c, title: conceptTitle(c), moduleCode: m.code, lessons: [] };
        info.lessons.push(ref);
        concepts.set(c, info);
      }
      if (!bundle) continue;
      goVersion ??= bundle.expected.goVersion;
      cards.push(
        ...lessonCards({ lessonRef: ref, lessonTitle: l.title, concepts: l.concepts, lesson: bundle.lesson, expected: bundle.expected, trapCode: bundle.files.trap }),
      );
    }
  }
  return { cards, concepts: [...concepts.values()], lessons, goVersion };
}
