import type { Metadata } from "next";
import Link from "next/link";
import { Caption, NotImplemented, Page, DisplayHeading } from "@/components/ui";
import { isLessonAuthored } from "@/lib/content/authored";
import { track } from "@/lib/content/track";
import { LOCAL_ONLY, localOnlyFeatures } from "@/lib/engine/features";

export const metadata: Metadata = { title: "Track" };

export default function TrackPage() {
  return (
    <Page>
      <Caption className="pt-14">Track · every module in order</Caption>
      <DisplayHeading className="mt-6 text-[clamp(2.4rem,6.5vw,4.8rem)]">{track.title}</DisplayHeading>

      <div className="mt-14 border-t border-line">
        {track.modules.map((m) => (
          <section key={m.slug} className="grid gap-x-10 gap-y-4 border-b border-rule py-9 lg:grid-cols-[18rem_1fr]" data-testid={`module-${m.code}`}>
            <div>
              <p className="font-display text-[2.6rem] leading-none font-extrabold text-accent">{m.code}</p>
              <h2 className="mt-3 font-display text-[1.15rem] leading-snug font-bold">{m.title}</h2>
              <span className="label mt-2 block">{m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}</span>
            </div>
            <ul className="divide-y divide-rule border-y border-rule">
              {m.lessons.map((l) => {
                const authored = isLessonAuthored(m.slug, l.slug);
                return (
                  <li key={l.slug} className="flex flex-wrap items-center justify-between gap-3 px-1 py-3.5">
                    {authored ? (
                      <Link href={`/track/${m.slug}/${l.slug}`} className="text-[1.08rem] font-medium transition-colors hover:text-accent">
                        {l.title}
                      </Link>
                    ) : (
                      <span className="text-[1.08rem] text-ink-3">{l.title}</span>
                    )}
                    <span className="flex flex-wrap items-center gap-2">
                      {l.concepts.map((c) => (
                        <span key={c} className="border border-rule px-1.5 py-0.5 font-mono text-[0.68rem] text-ink-3">
                          {c}
                        </span>
                      ))}
                      {authored && localOnlyFeatures(l.requires).length > 0 && (
                        <span
                          data-testid={`local-badge-${l.slug}`}
                          title={`Needs ${localOnlyFeatures(l.requires)
                            .map((f) => LOCAL_ONLY[f]?.label ?? f)
                            .join(", ")}: those parts show recorded real-Go output or a command to run locally.`}
                          className="border border-warn px-1.5 py-0.5 font-mono text-[0.68rem] text-warn"
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
