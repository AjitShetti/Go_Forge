import type { Metadata } from "next";
import { utcStamp } from "@/lib/format";
import Link from "next/link";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { designAccess } from "@/lib/canvas/designs.server";
import { track } from "@/lib/content/track";
import { DeleteEntryButton, NoteForm } from "./notebook-client";

export const metadata: Metadata = { title: "Notebook" };
export const dynamic = "force-dynamic";

type Entry = { id: string; kind: "stretch" | "note"; body: string; createdAt: string; lessonRef: string | null };

const lessonByRef = new Map<string, { href: string; label: string }>(
  track.modules.flatMap((m) => m.lessons.map((l) => [`go/${m.slug}/${l.slug}`, { href: `/track/${m.slug}/${l.slug}`, label: `${m.code} · ${l.title}` }] as const)),
);

export default async function NotebookPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const filter = kind === "stretch" || kind === "note" ? kind : null;
  const access = await designAccess();
  let entries: Entry[] = [];
  let loadError: string | null = null;
  if (access.kind === "ok") {
    const { data, error } = await access.supabase.from("notebook").select("id, kind, body, created_at, lessons(content_ref)").order("created_at", { ascending: false }).limit(1000);
    if (error) loadError = error.message;
    else
      entries = data.map((r) => ({
        id: r.id,
        kind: r.kind,
        body: r.body,
        createdAt: r.created_at,
        lessonRef: (r.lessons as unknown as { content_ref: string } | null)?.content_ref ?? null,
      }));
  }
  const shown = filter ? entries.filter((e) => e.kind === filter) : entries;
  const count = (k: Entry["kind"]) => entries.filter((e) => e.kind === k).length;

  return (
    <Page>
      <Caption className="pt-10">Notebook · stretch answers and notes</Caption>
      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Notebook</DisplayHeading>
      <p className="prose-serif mt-6 max-w-2xl text-ink-2">
        Every stretch answer you submit in a lesson lands here, next to your own notes. Nothing here is graded.
      </p>

      {access.kind === "not-configured" && (
        <div className="panel mt-8 max-w-2xl p-5" data-testid="notebook-gate" data-kind="not-configured">
          <p className="font-mono text-[0.75rem] text-bad">DB not connected</p>
          <p className="prose-serif mt-2 text-ink-2">Supabase isn&apos;t configured, so there is nowhere to keep notes.</p>
        </div>
      )}
      {access.kind === "signed-out" && (
        <div className="panel mt-8 max-w-2xl p-5" data-testid="notebook-gate" data-kind="signed-out">
          <p className="prose-serif text-ink-2">
            <Link href="/login" className="text-accent underline underline-offset-2">
              Sign in
            </Link>{" "}
            to see your stretch answers and keep notes.
          </p>
        </div>
      )}
      {loadError && (
        <div className="panel mt-8 max-w-2xl p-5" data-testid="notebook-gate" data-kind="error">
          <p className="font-mono text-[0.75rem] text-bad">Could not load your notebook</p>
          <p className="mt-2 font-mono text-sm text-ink-2">{loadError}</p>
        </div>
      )}

      {access.kind === "ok" && !loadError && (
        <>
          <NoteForm lessons={[...lessonByRef].map(([ref, l]) => ({ ref, label: l.label }))} />

          <div className="panel mt-8" data-testid="notebook-list">
            <div className="panel-head flex-wrap gap-3">
              <span className="label">Entries</span>
              <nav aria-label="Filter entries" className="flex gap-4 font-mono text-[0.72rem]">
                {[
                  [null, `All ${entries.length}`],
                  ["stretch", `Stretch ${count("stretch")}`],
                  ["note", `Notes ${count("note")}`],
                ].map(([k, label]) => (
                  <Link key={label} href={k ? `/notebook?kind=${k}` : "/notebook"} aria-current={filter === k ? "page" : undefined} className={filter === k ? "text-accent underline underline-offset-4" : "text-ink-2 hover:text-accent"}>
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            {shown.length === 0 ? (
              <p className="prose-serif px-4 py-6 text-ink-3 italic" data-testid="no-entries">
                {entries.length === 0 ? "Nothing yet. Finish a lesson's stretch step, or write a note above." : "No entries of this kind."}
              </p>
            ) : (
              <ul className="divide-y divide-rule">
                {shown.map((e) => {
                  const lesson = e.lessonRef ? lessonByRef.get(e.lessonRef) : null;
                  return (
                    <li key={e.id} className="px-4 py-4" data-testid="notebook-entry" data-kind={e.kind}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className={`border px-1.5 py-0.5 font-mono text-[0.66rem] ${e.kind === "stretch" ? "border-accent text-accent" : "border-rule text-ink-2"}`}>{e.kind}</span>
                        {lesson ? (
                          <Link href={lesson.href} className="prose-serif min-w-0 flex-1 text-accent underline-offset-2 hover:underline">
                            {lesson.label}
                          </Link>
                        ) : (
                          <span className="prose-serif flex-1 text-ink-3 italic">No lesson</span>
                        )}
                        <time className="font-mono text-[0.72rem] text-ink-3" dateTime={e.createdAt}>
                          {utcStamp(e.createdAt)}
                        </time>
                        <DeleteEntryButton id={e.id} />
                      </div>
                      <p className="mt-3 font-mono text-sm break-words whitespace-pre-wrap" data-testid="entry-body">
                        {e.body}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
