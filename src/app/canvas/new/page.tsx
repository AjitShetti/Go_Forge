import type { Metadata } from "next";
import Link from "next/link";
import { DesignEditor } from "@/components/canvas/editor";
import { Caption } from "@/components/ui";
import { designAccess } from "@/lib/canvas/designs.server";

export const metadata: Metadata = { title: "New design" };
export const dynamic = "force-dynamic";

export default async function NewDesignPage() {
  const access = await designAccess();
  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-24 sm:px-8">
      <div className="flex flex-wrap items-center gap-4 pt-6 pb-4">
        <Link href="/canvas" className="label hover:text-blue">
          ← Designs
        </Link>
        <Caption>FIG_031 · New design</Caption>
      </div>
      <DesignEditor mode={access.kind} design={null} versions={[]} />
    </main>
  );
}
