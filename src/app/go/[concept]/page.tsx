import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Markdown } from "@/components/markdown";
import { Caption, DisplayHeading, Page } from "@/components/ui";
import { loadConcept, loadConcepts } from "@/lib/content/concepts.server";
import { abs, breadcrumbs, jsonLdScript, SITE_NAME, summarize } from "@/lib/seo";

type Params = { concept: string };

const load = cache(loadConcept);

export function generateStaticParams() {
  return loadConcepts().map((c) => ({ concept: c.slug }));
}

/** The prose a search result should quote: the concept's first real explanation. */
const firstProse = (c: NonNullable<ReturnType<typeof loadConcept>>) => c.lessons.find((l) => l.decode)?.decode;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const concept = load((await params).concept);
  if (!concept) return { title: "Concept" };

  const title = `${concept.title} in Go`;
  const description = summarize(firstProse(concept), 158) || `${concept.title} in Go, explained and drilled in ${concept.lessons.length} lesson${concept.lessons.length === 1 ? "" : "s"}.`;
  const path = `/go/${concept.slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "article", url: path, title: `${title} · ${SITE_NAME}`, description, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE_NAME}`, description },
  };
}

export default async function ConceptPage({ params }: { params: Promise<Params> }) {
  const concept = load((await params).concept);
  if (!concept) notFound();

  const path = `/go/${concept.slug}`;
  const description = summarize(firstProse(concept), 158) || `${concept.title} in Go.`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": abs(path),
        url: abs(path),
        headline: `${concept.title} in Go`,
        description,
        inLanguage: "en",
        isAccessibleForFree: true,
        proficiencyLevel: "Intermediate",
        about: [
          { "@type": "Thing", name: "Go (programming language)" },
          { "@type": "Thing", name: concept.title },
        ],
        publisher: { "@id": abs("/#organization") },
      },
      breadcrumbs([
        { name: SITE_NAME, path: "/" },
        { name: "Go reference", path: "/go" },
        { name: concept.title, path },
      ]),
    ],
  };

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />

      <div className="flex flex-wrap items-center gap-4 pt-10">
        <Link href="/go" className="label hover:text-accent">
          ← Go reference
        </Link>
        <Caption>{concept.moduleCode}</Caption>
      </div>

      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">{concept.title} in Go</DisplayHeading>

      <p className="prose-serif mt-6 max-w-2xl text-ink-2">
        Explained below, then drilled in {concept.lessons.length} {concept.lessons.length === 1 ? "lesson" : "lessons"} where you predict the output before you run it. Every program on this page was
        compiled and run by real Go ({concept.lessons[0]?.goVersion}) - the outputs are recorded, not written by hand.
      </p>

      {concept.lessons.map((l) => (
        <section key={`${l.moduleSlug}/${l.lessonSlug}`} className="mt-16 border-t border-line pt-10">
          <Caption>
            {l.moduleCode} {l.moduleTitle}
          </Caption>
          <h2 className="mt-4 font-display text-[clamp(1.5rem,3.4vw,2.2rem)] leading-tight font-extrabold">{l.title}</h2>
          <p className="prose-serif mt-3 max-w-2xl text-ink-3 italic">{l.question}</p>

          {l.decode && (
            <div className="mt-8">
              <Markdown source={l.decode} verified={l.verified} goVersion={l.goVersion} />
            </div>
          )}

          {l.contrast && (
            <details className="panel mt-8">
              <summary className="panel-head cursor-pointer">
                <span className="label">Coming from Python or JavaScript</span>
                <span className="label text-accent">expand</span>
              </summary>
              <div className="p-5">
                <Markdown source={l.contrast} />
              </div>
            </details>
          )}

          <Link href={`/track/${l.moduleSlug}/${l.lessonSlug}`} className="btn btn-primary mt-10">
            Try the lesson: {l.title} →
          </Link>
        </section>
      ))}
    </Page>
  );
}
