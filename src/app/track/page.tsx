import type { Metadata } from "next";
import Link from "next/link";
import { Caption, NotImplemented, Page, PixelHeading } from "@/components/ui";
import { isLessonAuthored } from "@/lib/content/authored";
import { track } from "@/lib/content/track";
import { LOCAL_ONLY, localOnlyFeatures } from "@/lib/engine/features";

export const metadata: Metadata = { title: "Track" };

export default function TrackPage() {
  return (
    <Page>
      <Caption className="pt-10">FIG_010 · Track · {track.slug}</Caption>
      <PixelHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">{track.title}</PixelHeading>

      <div className="mt-10 grid gap-6">
        {track.modules.map((m) => (
          <section key={m.slug} className="panel" data-testid={`module-${m.code}`}>
            <div className="panel-head">
              <h2 className="font-mono text-sm tracking-[0.12em] uppercase">
                <span className="text-blue">{m.code}</span> · {m.title}
              </h2>
              <span className="label">{m.lessons.length} lessons</span>
            </div>
            <ul className="divide-y divide-rule">
              {m.lessons.map((l) => {
                const authored = isLessonAuthored(m.slug, l.slug);
                return (
                  <li key={l.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    {authored ? (
                      <Link href={`/track/${m.slug}/${l.slug}`} className="prose-serif text-lg hover:text-blue">
                        {l.title}
                      </Link>
                    ) : (
                      <span className="prose-serif text-lg text-ink-3">{l.title}</span>
                    )}
                    <span className="flex flex-wrap items-center gap-2">
                      {l.concepts.map((c) => (
                        <span key={c} className="border border-rule px-1.5 py-0.5 font-mono text-[0.68rem] text-ink-2">
                          {c}
                        </span>
                      ))}
                      {authored && localOnlyFeatures(l.requires).length > 0 && (
                        <span
                          data-testid={`local-badge-${l.slug}`}
                          title={`Needs ${localOnlyFeatures(l.requires)
                            .map((f) => LOCAL_ONLY[f]?.label ?? f)
                            .join(", ")}: those parts show recorded real-Go output or a command to run locally.`}
                          className="border border-warn px-1.5 py-0.5 font-mono text-[0.68rem] tracking-[0.1em] text-warn uppercase"
                        >
                          Partly run locally
                        </span>
                      )}
                      {!authored && <NotImplemented what="lesson not authored" />}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}
