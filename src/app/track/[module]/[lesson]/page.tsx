import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLessonBundle } from "@/lib/content/load";
import { isLessonAuthored } from "@/lib/content/authored";
import { contentRef, findLesson, nextLesson } from "@/lib/content/track";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServer, getCurrentUser } from "@/lib/supabase/server";
import { LessonPlayer, type PersistenceContext } from "./lesson-player";

type Params = { module: string; lesson: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { module, lesson } = await params;
  return { title: findLesson(module, lesson)?.lesson.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { module, lesson } = await params;
  const ref = findLesson(module, lesson);
  const bundle = ref ? loadLessonBundle(module, lesson) : null;
  if (!ref || !bundle) notFound();

  const persistence = await resolvePersistence(contentRef(module, lesson), bundle.lesson.frontmatter.trap.concept);
  const lessonIndex = ref.module.lessons.findIndex((l) => l.slug === lesson);
  const next = nextLesson(module, lesson);
  const [, , nextModule, nextSlug] = next?.href.split("/") ?? [];

  return (
    <LessonPlayer
      bundle={bundle}
      moduleCode={ref.module.code}
      moduleTitle={ref.module.title}
      lessonNumber={lessonIndex + 1}
      persistence={persistence}
      next={next && isLessonAuthored(nextModule, nextSlug) ? next : null}
    />
  );
}

async function resolvePersistence(ref: string, trapConcept: string): Promise<PersistenceContext> {
  if (!getSupabaseConfig()) return { kind: "off", reason: "Supabase is not configured" };
  const user = await getCurrentUser();
  if (!user) return { kind: "off", reason: "You are not signed in" };
  const supabase = (await createSupabaseServer())!;
  const [{ data: lessonRow, error: lessonErr }, { data: conceptRow }] = await Promise.all([
    supabase.from("lessons").select("id").eq("content_ref", ref).maybeSingle(),
    supabase.from("concepts").select("id").eq("slug", trapConcept).maybeSingle(),
  ]);
  if (lessonErr || !lessonRow) return { kind: "off", reason: `Lesson ${ref} is not in the database yet` };
  return { kind: "on", userId: user.id, lessonId: lessonRow.id, trapConceptId: conceptRow?.id ?? null };
}
