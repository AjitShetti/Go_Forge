import { Caption, NotImplemented, Page, PixelHeading } from "@/components/ui";

export function PlaceholderPage({ fig, title, milestone, children }: { fig: string; title: string; milestone: string; children: React.ReactNode }) {
  return (
    <Page>
      <Caption className="pt-10">{fig}</Caption>
      <PixelHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">{title}</PixelHeading>
      <div className="mt-8">
        <NotImplemented milestone={milestone} />
      </div>
      <div className="prose-serif mt-6 max-w-2xl text-ink-2">{children}</div>
    </Page>
  );
}
