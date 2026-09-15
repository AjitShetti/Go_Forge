import type { Metadata } from "next";
import Link from "next/link";
import { Caption, Page, PixelHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <Page className="max-w-2xl">
      <Caption className="pt-10">FIG_404 · Not found</Caption>
      <PixelHeading className="mt-6 text-[clamp(2.4rem,8vw,5rem)]">404</PixelHeading>
      <p className="prose-serif mt-6 text-lg text-ink-2" data-testid="not-found">
        Nothing lives at this address. If you followed a lesson or design link, it may have been renamed or deleted.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/track" className="btn btn-primary">
          Go to the track
        </Link>
        <Link href="/canvas" className="btn">
          Your designs
        </Link>
      </div>
    </Page>
  );
}
