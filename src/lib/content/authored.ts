import { existsSync } from "node:fs";
import { join } from "node:path";

/** A lesson is authored when its lesson.md exists on disk. Server-only. */
export function isLessonAuthored(moduleSlug: string, lessonSlug: string): boolean {
  return existsSync(join(process.cwd(), "content", "go", moduleSlug, lessonSlug, "lesson.md"));
}
