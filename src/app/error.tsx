"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Caption, Page, PixelHeading } from "@/components/ui";
import { issueUrl } from "@/lib/site";

// Shown when a page throws while rendering (for example the database is unreachable).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [path, setPath] = useState("");
  useEffect(() => setPath(window.location.pathname), []);
  return (
    <Page className="max-w-2xl">
      <Caption className="pt-10">Something broke</Caption>
      <PixelHeading className="mt-6 text-[clamp(2.4rem,8vw,5rem)]">Error</PixelHeading>
      <p className="prose-serif mt-6 text-lg text-ink-2" data-testid="error-page">
        This page failed to load. Your saved progress is not affected. Try again; if it keeps happening, the database or the network is probably down.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-ink-3">digest {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn">
          Home
        </Link>
        <a
          href={issueUrl("bug_report.yml", { page: path, what: `The page showed "This page failed to load."${error.digest ? ` Digest: ${error.digest}` : ""}` })}
          target="_blank"
          rel="noreferrer"
          className="btn"
          data-testid="error-report"
        >
          Report it ↗
        </a>
      </div>
    </Page>
  );
}
