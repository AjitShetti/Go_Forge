import type { Metadata } from "next";
import { Caption, Page, PixelHeading } from "@/components/ui";
import { EngineLab } from "./engine-lab";

export const metadata: Metadata = { title: "Engine" };

export default function EnginePage() {
  return (
    <Page>
      <Caption className="pt-10">FIG_060 · Execution engine · gc toolchain in WebAssembly</Caption>
      <PixelHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Engine</PixelHeading>
      <p className="prose-serif mt-4 max-w-3xl text-ink-2">
        The real <code>cmd/compile</code> and <code>cmd/link</code>, compiled to WebAssembly, run in a worker in this tab. No server runs your code. Known differences from native Go are listed in{" "}
        <code>docs/execution-engine.md</code>.
      </p>
      <EngineLab />
    </Page>
  );
}
