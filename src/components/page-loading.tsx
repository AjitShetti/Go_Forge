import { Caption, DisplayHeading, Page } from "@/components/ui";

/**
 * The shell of a personal page, shown while the server renders the real thing.
 *
 * These four routes read the session and query Supabase, so they cannot be
 * prerendered and take ~400ms to answer. A `loading.tsx` built on this puts the
 * heading on screen on the click instead of at the end of that wait, and it gives
 * the router a boundary to prefetch down to — so `prefetch="auto"` on the nav costs
 * a shell rather than a full render of a page most readers never open.
 *
 * The caption and title match the real page's exactly, so nothing moves when the
 * content arrives.
 */
export function PageLoading({ caption, title, aside }: { caption: string; title: string; aside?: boolean }) {
  return (
    <Page>
      {aside ? (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-10">
          <Caption>{caption}</Caption>
        </div>
      ) : (
        <Caption className="pt-10">{caption}</Caption>
      )}
      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">{title}</DisplayHeading>
      <p className="mt-10 font-mono text-sm text-ink-3">Loading…</p>
    </Page>
  );
}
