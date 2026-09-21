import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { loadLessonBundle } from "@/lib/content/load";
import { isLessonAuthored } from "@/lib/content/authored";
import { contentRef, findLesson, nextLesson, track } from "@/lib/content/track";
import { abs, breadcrumbs, jsonLdScript, lessonDescription, SITE_NAME } from "@/lib/seo";
import { LessonPlayer } from "./lesson-player";

type Params = { module: string; lesson: string };

/** generateMetadata and the page both need the bundle; this reads it from disk once. */
const loadOnce = cache(loadLessonBundle);

/**
 * Prerenders every authored lesson. Nothing in this route reads cookies any more -
 * the player resolves the session in the browser - so these 43 pages are static:
 * served from the edge, cheap to crawl, and free for the router to prefetch.
 */
export function generateStaticParams() {
  return track.modules.flatMap((m) => m.lessons.filter((l) => isLessonAuthored(m.slug, l.slug)).map((l) => ({ module: m.slug, lesson: l.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { module, lesson } = await params;
  const ref = findLesson(module, lesson);
  if (!ref) return { title: "Lesson" };

  const bundle = isLessonAuthored(module, lesson) ? loadOnce(module, lesson) : null;
  const fm = bundle?.lesson.frontmatter;
  const title = fm?.title ?? ref.lesson.title;
  const description = bundle ? lessonDescription(bundle.lesson.sections.Decode, fm!.trap.question, title) : `${title} - a Go lesson you predict before you run.`;
  const path = `/track/${module}/${lesson}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "article", url: path, title: `${title} · ${SITE_NAME}`, description, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE_NAME}`, description },
  };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { module, lesson } = await params;
  const ref = findLesson(module, lesson);
  const bundle = ref ? loadOnce(module, lesson) : null;
  if (!ref || !bundle) notFound();

  const lessonIndex = ref.module.lessons.findIndex((l) => l.slug === lesson);
  const next = nextLesson(module, lesson);
  const [, , nextModule, nextSlug] = next?.href.split("/") ?? [];

  const fm = bundle.lesson.frontmatter;
  const path = `/track/${module}/${lesson}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource",
        "@id": abs(path),
        url: abs(path),
        name: fm.title,
        description: lessonDescription(bundle.lesson.sections.Decode, fm.trap.question, fm.title),
        learningResourceType: "Interactive lesson",
        educationalLevel: "Intermediate",
        teaches: fm.concepts,
        about: [{ "@type": "Thing", name: "Go (programming language)" }, ...fm.concepts.map((c) => ({ "@type": "Thing", name: c }))],
        inLanguage: "en",
        isAccessibleForFree: true,
        isPartOf: { "@type": "Course", "@id": abs("/track#course"), name: "Go from first principles" },
        position: lessonIndex + 1,
      },
      breadcrumbs([
        { name: SITE_NAME, path: "/" },
        { name: "Track", path: "/track" },
        { name: ref.module.title, path: "/track" },
        { name: fm.title, path },
      ]),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <LessonPlayer
        bundle={bundle}
        moduleCode={ref.module.code}
        moduleTitle={ref.module.title}
        lessonNumber={lessonIndex + 1}
        contentRef={contentRef(module, lesson)}
        next={next && isLessonAuthored(nextModule, nextSlug) ? next : null}
      />
    </>
  );
}
