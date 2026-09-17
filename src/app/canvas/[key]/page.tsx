import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignEditor } from "@/components/canvas/editor";
import { Caption, Page } from "@/components/ui";
import { UUID, designAccess, latestReview, listVersions, loadVersion, parseVersionParam } from "@/lib/canvas/designs.server";

export const metadata: Metadata = { title: "Design" };
export const dynamic = "force-dynamic";

export default async function DesignPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { key } = await params;
  const version = parseVersionParam((await searchParams).v);
  if (!UUID.test(key) || version === "bad") notFound();

  const access = await designAccess();
  if (access.kind !== "ok") {
    return (
      <Page>
        <Caption className="pt-10">Design</Caption>
        <div className="panel mt-8 max-w-2xl p-5" data-testid="designs-gate" data-kind={access.kind}>
          <p className="prose-serif text-ink-2">
            Saved designs belong to an account.{" "}
            {access.kind === "signed-out" ? (
              <Link href="/login" className="text-blue underline underline-offset-2">
                Sign in
              </Link>
            ) : (
              "Supabase is not configured"
            )}{" "}
            to open this one.
          </p>
        </div>
      </Page>
    );
  }

  // RLS: another user's design key looks exactly like a missing one.
  const [loaded, versions] = await Promise.all([loadVersion(access.supabase, key, version), listVersions(access.supabase, key)]);
  if (loaded.kind === "missing") notFound();
  if (loaded.kind === "invalid") {
    return (
      <Page>
        <Caption className="pt-10">Design</Caption>
        <div className="panel mt-8 max-w-2xl p-5" data-testid="design-invalid">
          <p className="font-mono text-[0.75rem] tracking-[0.14em] text-bad uppercase">This version can&apos;t be opened</p>
          <p className="prose-serif mt-2 text-ink-2">The stored graph doesn&apos;t match the design format, so it isn&apos;t drawn half-broken. Problems:</p>
          <ul className="mt-2 list-disc pl-5 font-mono text-[0.76rem] text-bad">
            {loaded.errors.slice(0, 10).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </Page>
    );
  }

  const d = loaded.value;
  const lastReview = await latestReview(access.supabase, d.id).catch(() => null);
  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-24 sm:px-8">
      <div className="flex flex-wrap items-center gap-4 pt-6 pb-4">
        <Link href="/canvas" className="label hover:text-blue">
          ← Designs
        </Link>
        <Caption>
          {d.name} · v{d.version}
        </Caption>
      </div>
      <DesignEditor
        key={`${key}:${version ?? "latest"}`}
        mode="ok"
        design={{ designKey: key, name: d.name, latestVersion: versions[0]?.version ?? d.version, openedVersion: d.version, graph: d.graph, scenario: d.scenarioSlug, lastReview }}
        versions={versions}
      />
    </main>
  );
}
