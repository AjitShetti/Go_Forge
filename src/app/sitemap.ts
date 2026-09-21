import type { MetadataRoute } from "next";
import { isLessonAuthored } from "@/lib/content/authored";
import { loadConcepts } from "@/lib/content/concepts.server";
import { track } from "@/lib/content/track";
import { SCENARIOS } from "@/lib/grader/scenarios";
import { SITE_URL } from "@/lib/site";

/**
 * Every page worth indexing, in one file. Unauthored lessons are left out on
 * purpose: they render as a dead entry in the track list and would be a 404 or a
 * stub to a crawler. Private routes are excluded here and in robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE_URL}${path}`;

  const lessons = track.modules.flatMap((m) =>
    m.lessons
      .filter((l) => isLessonAuthored(m.slug, l.slug))
      .map((l) => ({
        url: url(`/track/${m.slug}/${l.slug}`),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
  );

  // The reference pages carry the explanations a search result can actually show,
  // so they rank alongside the lessons rather than below them.
  const concepts = loadConcepts().map((c) => ({
    url: url(`/go/${c.slug}`),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/track"), changeFrequency: "weekly", priority: 0.9 },
    { url: url("/go"), changeFrequency: "weekly", priority: 0.9 },
    ...concepts,
    ...lessons,
    { url: url("/scenarios"), changeFrequency: "monthly", priority: 0.7 },
    ...SCENARIOS.map((s) => ({
      url: url(`/scenarios/${s.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: url("/engine"), changeFrequency: "monthly", priority: 0.6 },
  ];
}
