import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiffView } from "@/components/canvas/diff-view";
import { Caption, Page } from "@/components/ui";
import { UUID, designAccess, listVersions, loadVersion, parseVersionParam } from "@/lib/canvas/designs.server";

export const metadata: Metadata = { title: "Design diff" };
export const dynamic = "force-dynamic";

export default async function DesignDiffPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { key } = await params;
  const sp = await searchParams;
  const fromParam = parseVersionParam(sp.from);
  const toParam = parseVersionParam(sp.to);
  if (!UUID.test(key) || fromParam === "bad" || toParam === "bad") notFound();

  const access = await designAccess();
  if (access.kind !== "ok") {
    return (
      <Page>
        <Caption className="pt-10">FIG_032 · Design diff</Caption>
        <div className="panel mt-8 max-w-2xl p-5" data-testid="designs-gate" data-kind={access.kind}>
          <p className="prose-serif text-ink-2">
            {access.kind === "signed-out" ? (
              <Link href="/login" className="text-blue underline underline-offset-2">
                Sign in
              </Link>
            ) : (
              "Configure Supabase"
            )}{" "}
            to compare saved versions.
          </p>
        </div>
      </Page>
    );
  }

  const versions = await listVersions(access.supabase, key);
  if (versions.length === 0) notFound();
  const latest = versions[0].version;
  const to = toParam ?? latest;
  const from = fromParam ?? Math.max(1, to - 1);
  const [a, b] = await Promise.all([loadVersion(access.supabase, key, from), loadVersion(access.supabase, key, to)]);
  if (a.kind === "missing" || b.kind === "missing") notFound();
  const name = versions[0].name;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-24 sm:px-8">
      <div className="flex flex-wrap items-center gap-4 pt-6 pb-4">
        <Link href={`/canvas/${key}`} className="label hover:text-blue">
          ← {name}
        </Link>
        <Caption>
          FIG_032 · Diff v{from} → v{to}
        </Caption>
      </div>

      <form className="panel mb-4 flex flex-wrap items-end gap-3 px-3 py-2.5" method="get" data-testid="diff-picker">
        <label className="font-mono text-[0.74rem]">
          <span className="label block text-[0.62rem]">From</span>
          <select name="from" defaultValue={from} className="field mt-1 w-auto py-1">
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version} · {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="font-mono text-[0.74rem]">
          <span className="label block text-[0.62rem]">To</span>
          <select name="to" defaultValue={to} className="field mt-1 w-auto py-1">
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version} · {v.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn px-3 py-1.5 text-[0.78rem]">Compare</button>
        <p className="font-mono text-[0.7rem] text-ink-3">Green added · amber changed · dashed red removed</p>
      </form>

      {a.kind === "invalid" || b.kind === "invalid" ? (
        <div className="panel p-5 font-mono text-[0.78rem] text-bad" data-testid="design-invalid">
          One of these versions doesn&apos;t match the design format and can&apos;t be compared: {(a.kind === "invalid" ? a.errors : b.kind === "invalid" ? b.errors : []).slice(0, 5).join("; ")}
        </div>
      ) : (
        <DiffView from={a.value.graph} to={b.value.graph} fromVersion={from} toVersion={to} />
      )}
    </main>
  );
}
