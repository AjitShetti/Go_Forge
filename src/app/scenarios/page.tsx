import type { Metadata } from "next";
import Link from "next/link";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { SCENARIOS } from "@/lib/grader/scenarios";
import { SITE_NAME } from "@/lib/seo";

const DESCRIPTION = `${SCENARIOS.length} system design exercises — ticketing flash sale, URL shortener, news feed fan-out, rate-limited API, file storage with a CDN, chat presence. Sketch the system, then have it graded against real load and constraints.`;

export const metadata: Metadata = {
  title: "System design scenarios",
  description: DESCRIPTION,
  alternates: { canonical: "/scenarios" },
  openGraph: { type: "website", url: "/scenarios", title: `System design scenarios · ${SITE_NAME}`, description: DESCRIPTION, siteName: SITE_NAME },
};

export default function ScenariosPage() {
  return (
    <Page>
      <Caption className="pt-10">Design scenarios</Caption>
      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Scenarios</DisplayHeading>
      <p className="prose-serif mt-6 max-w-2xl text-ink-2">
        Each scenario states what the system must do, the numbers it must survive, and a few hard constraints. You design on the canvas; Grade runs a fixed set of rules and shows the arithmetic behind every finding.
      </p>
      <ul className="mt-8 grid gap-4" data-testid="scenario-list">
        {SCENARIOS.map((s) => (
          <li key={s.slug} className="panel p-5">
            <Link href={`/scenarios/${s.slug}`} className="font-display text-[1.3rem] font-extrabold text-ink transition-colors hover:text-accent">
              {s.title}
            </Link>
            <p className="prose-serif mt-2 text-ink-2">{s.summary}</p>
            <p className="mt-2 font-mono text-[0.72rem] text-ink-3">
              peak {s.scale.peakQps.toLocaleString("en-US")} rps · {s.constraints.length} hard constraints · {s.rules.length} rules
            </p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
