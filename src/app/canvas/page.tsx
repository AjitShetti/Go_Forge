import type { Metadata } from "next";
import { utcStamp } from "@/lib/format";
import Link from "next/link";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { designAccess, listDesigns } from "@/lib/canvas/designs.server";
import { DeleteDesignButton } from "./delete-button";

export const metadata: Metadata = { title: "Design canvas" };
export const dynamic = "force-dynamic";

export default async function CanvasPage() {
  const access = await designAccess();
  let designs: Awaited<ReturnType<typeof listDesigns>> = [];
  let loadError: string | null = null;
  if (access.kind === "ok") {
    try {
      designs = await listDesigns(access.supabase);
    } catch (e) {
      loadError = (e as Error).message;
    }
  }

  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-10">
        <Caption>System design canvas</Caption>
        <Link href="/scenarios" className="label text-accent hover:underline">
          Scenarios + grading →
        </Link>
      </div>
      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Canvas</DisplayHeading>
      <p className="prose-serif mt-6 max-w-2xl text-ink-2">
        Lay out components, wire them with the kind of connection they really use, and set the numbers that matter: replicas, per-replica QPS, latency, storage, consistency. Every save is a new version you can diff against the
        last.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/canvas/new" className="btn btn-primary" data-testid="new-design">
          New design
        </Link>
      </div>

      {access.kind === "not-configured" && (
        <div className="panel mt-8 max-w-2xl p-5" data-testid="designs-gate" data-kind="not-configured">
          <p className="font-mono text-[0.75rem] text-bad">DB not connected</p>
          <p className="prose-serif mt-2 text-ink-2">Supabase isn&apos;t configured, so designs can&apos;t be saved. The canvas still works; use Export JSON to keep a copy.</p>
        </div>
      )}
      {access.kind === "signed-out" && (
        <div className="panel mt-8 max-w-2xl p-5" data-testid="designs-gate" data-kind="signed-out">
          <p className="prose-serif text-ink-2">
            <Link href="/login" className="text-accent underline underline-offset-2">
              Sign in
            </Link>{" "}
            to save designs and keep their version history. Signed out, a new design works but is not saved; Export JSON keeps a copy.
          </p>
        </div>
      )}
      {loadError && (
        <div className="panel mt-8 max-w-2xl p-5" data-testid="designs-gate" data-kind="error">
          <p className="font-mono text-[0.75rem] text-bad">Could not load your designs</p>
          <p className="mt-2 font-mono text-sm text-ink-2">{loadError}</p>
        </div>
      )}

      {access.kind === "ok" && !loadError && (
        <div className="panel mt-8" data-testid="design-list">
          <div className="panel-head">
            <span className="label">Your designs</span>
            <span className="font-mono text-[0.72rem] text-ink-3">{designs.length}</span>
          </div>
          {designs.length === 0 ? (
            <p className="prose-serif px-4 py-6 text-ink-3 italic" data-testid="no-designs">
              No saved designs yet.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {designs.map((d) => (
                <li key={d.designKey} data-testid={`design-${d.designKey}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                  <Link href={`/canvas/${d.designKey}`} className="min-w-0 flex-1 basis-56 truncate font-mono text-[0.92rem] text-accent underline-offset-2 hover:underline">
                    {d.name}
                  </Link>
                  <span className="font-mono text-[0.74rem] text-ink-2">
                    v{d.latestVersion} · {d.versions} version{d.versions === 1 ? "" : "s"}
                  </span>
                  <time className="font-mono text-[0.74rem] text-ink-3" dateTime={d.updatedAt}>
                    saved {utcStamp(d.updatedAt)}
                  </time>
                  <DeleteDesignButton designKey={d.designKey} name={d.name} versions={d.versions} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Page>
  );
}
