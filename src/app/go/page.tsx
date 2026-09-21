import type { Metadata } from "next";
import Link from "next/link";
import { Caption, DisplayHeading, Page } from "@/components/ui";
import { loadConcepts } from "@/lib/content/concepts.server";
import { track } from "@/lib/content/track";
import { abs, breadcrumbs, jsonLdScript, SITE_NAME } from "@/lib/seo";

const DESCRIPTION =
  "Go explained one concept at a time: slices and their headers, strings as bytes and runes, pointers, escape analysis, interfaces, goroutines, channels and the memory model — each with programs run by real Go.";

export const metadata: Metadata = {
  title: "Go reference — one concept at a time",
  description: DESCRIPTION,
  alternates: { canonical: "/go" },
  openGraph: { type: "website", url: "/go", title: `Go reference · ${SITE_NAME}`, description: DESCRIPTION, siteName: SITE_NAME },
};

export default function GoReferenceIndex() {
  const concepts = loadConcepts();

  // Grouped by module so the list reads in the order the ideas build on each other,
  // rather than alphabetically.
  const order = new Map(track.modules.map((m, i) => [m.code, i]));
  const byModule = new Map<string, { title: string; concepts: typeof concepts }>();
  for (const c of concepts) {
    const m = track.modules.find((m) => m.code === c.moduleCode);
    const group = byModule.get(c.moduleCode) ?? { title: m?.title ?? c.moduleCode, concepts: [] };
    group.concepts.push(c);
    byModule.set(c.moduleCode, group);
  }
  const groups = [...byModule.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": abs("/go"),
        url: abs("/go"),
        name: "Go reference",
        description: DESCRIPTION,
        inLanguage: "en",
        hasPart: concepts.map((c) => ({ "@type": "TechArticle", url: abs(`/go/${c.slug}`), headline: `${c.title} in Go` })),
      },
      breadcrumbs([
        { name: SITE_NAME, path: "/" },
        { name: "Go reference", path: "/go" },
      ]),
    ],
  };

  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />

      <Caption className="pt-14">Go reference · {concepts.length} concepts</Caption>
      <DisplayHeading className="mt-6 text-[clamp(2.4rem,6.5vw,4.8rem)]">
        Go, one concept
        <br />
        at a time<span className="text-accent">.</span>
      </DisplayHeading>

      <p className="prose-serif mt-8 max-w-2xl text-[1.05rem] text-ink-2">
        The explanation behind every lesson, readable on its own. Each page ends with the lesson that makes you predict it first — which is where it actually sticks.
      </p>

      <div className="mt-14 border-t border-line">
        {groups.map(([code, group]) => (
          <section key={code} className="grid gap-x-10 gap-y-4 border-b border-rule py-9 lg:grid-cols-[18rem_1fr]">
            <div>
              <p className="font-display text-[2.6rem] leading-none font-extrabold text-accent">{code}</p>
              <h2 className="mt-3 font-display text-[1.15rem] leading-snug font-bold">{group.title}</h2>
            </div>
            <ul className="divide-y divide-rule border-y border-rule">
              {group.concepts.map((c) => (
                <li key={c.slug} className="flex flex-wrap items-center justify-between gap-3 px-1 py-3.5">
                  {/* Not prefetched, as on /track: 52 links, one of which gets opened. */}
                  <Link href={`/go/${c.slug}`} prefetch={false} className="text-[1.08rem] font-medium transition-colors hover:text-accent">
                    {c.title} in Go
                  </Link>
                  <span className="font-mono text-[0.72rem] text-ink-3">
                    {c.lessons.length} {c.lessons.length === 1 ? "lesson" : "lessons"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}
