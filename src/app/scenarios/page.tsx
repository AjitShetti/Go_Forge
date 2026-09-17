import type { Metadata } from "next";
import Link from "next/link";
import { Caption, Page, PixelHeading } from "@/components/ui";
import { SCENARIOS } from "@/lib/grader/scenarios";

export const metadata: Metadata = { title: "Scenarios" };

export default function ScenariosPage() {
  return (
    <Page>
      <Caption className="pt-10">Design scenarios</Caption>
      <PixelHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Scenarios</PixelHeading>
      <p className="prose-serif mt-6 max-w-2xl text-ink-2">
        Each scenario states what the system must do, the numbers it must survive, and a few hard constraints. You design on the canvas; Grade runs a fixed set of rules and shows the arithmetic behind every finding.
      </p>
      <ul className="mt-8 grid gap-4" data-testid="scenario-list">
        {SCENARIOS.map((s) => (
          <li key={s.slug} className="panel p-5">
            <Link href={`/scenarios/${s.slug}`} className="font-mono text-[0.95rem] text-blue underline underline-offset-2">
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
