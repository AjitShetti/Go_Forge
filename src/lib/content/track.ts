import trackJson from "@content/go/track.json";

export type LessonRef = {
  slug: string;
  title: string;
  concepts: string[];
  requires: string[];
};

export type ModuleRef = {
  slug: string;
  code: string;
  title: string;
  lessons: LessonRef[];
};

export type Track = { slug: string; title: string; modules: ModuleRef[] };

export const track: Track = trackJson;

/** content_ref used in the lessons table: go/<module>/<lesson>. */
export const contentRef = (moduleSlug: string, lessonSlug: string) => `go/${moduleSlug}/${lessonSlug}`;

/** The lesson after this one in track order, crossing into the next module; null after the last. */
export function nextLesson(moduleSlug: string, lessonSlug: string): { href: string; title: string } | null {
  const all = track.modules.flatMap((m) => m.lessons.map((l) => ({ href: `/track/${m.slug}/${l.slug}`, title: l.title })));
  const i = all.findIndex((l) => l.href === `/track/${moduleSlug}/${lessonSlug}`);
  return i >= 0 && i + 1 < all.length ? all[i + 1] : null;
}

export function findLesson(moduleSlug: string, lessonSlug: string): { module: ModuleRef; lesson: LessonRef } | null {
  const module = track.modules.find((m) => m.slug === moduleSlug);
  const lesson = module?.lessons.find((l) => l.slug === lessonSlug);
  return module && lesson ? { module, lesson } : null;
}
