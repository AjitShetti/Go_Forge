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

export function findLesson(moduleSlug: string, lessonSlug: string): { module: ModuleRef; lesson: LessonRef } | null {
  const module = track.modules.find((m) => m.slug === moduleSlug);
  const lesson = module?.lessons.find((l) => l.slug === lessonSlug);
  return module && lesson ? { module, lesson } : null;
}
