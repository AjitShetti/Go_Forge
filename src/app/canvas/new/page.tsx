import type { Metadata } from "next";
import Link from "next/link";
import { DesignEditor } from "@/components/canvas/editor";
import { Caption } from "@/components/ui";
import { designAccess } from "@/lib/canvas/designs.server";
import { STARTS } from "@/lib/grader/examples";
import { scenarioBySlug } from "@/lib/grader/scenarios";

export const metadata: Metadata = { title: "New design" };
export const dynamic = "force-dynamic";

export default async function NewDesignPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const access = await designAccess();
  const scenario = typeof sp.scenario === "string" ? scenarioBySlug(sp.scenario) : null;
  const startGraph = scenario && typeof sp.start === "string" ? (sp.start === "naive" || sp.start === "reference" ? (STARTS[scenario.slug]?.[sp.start] ?? null) : null) : null;
  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-24 sm:px-8">
      <div className="flex flex-wrap items-center gap-4 pt-6 pb-4">
        <Link href="/canvas" className="label hover:text-accent">
          ← Designs
        </Link>
        <Caption>New design</Caption>
      </div>
      <DesignEditor mode={access.kind} design={null} versions={[]} startScenario={scenario?.slug ?? null} startGraph={startGraph} />
    </main>
  );
}
