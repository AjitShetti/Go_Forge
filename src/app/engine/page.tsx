import type { Metadata } from "next";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { LOCAL_ONLY } from "@/lib/engine/features";
import { SITE_NAME } from "@/lib/seo";
import { EngineLab } from "./engine-lab";

const DESCRIPTION =
  "Run Go in your browser with no install and no server: the real gc toolchain — cmd/compile and cmd/link — built to WebAssembly and running in a worker in your tab. Includes where it differs from go run on your machine.";

export const metadata: Metadata = {
  title: "Run Go in your browser — the gc toolchain in WebAssembly",
  description: DESCRIPTION,
  alternates: { canonical: "/engine" },
  openGraph: { type: "website", url: "/engine", title: `Run Go in your browser · ${SITE_NAME}`, description: DESCRIPTION, siteName: SITE_NAME },
};

export default function EnginePage() {
  return (
    <Page>
      <Caption className="pt-10">Execution engine · gc toolchain in WebAssembly</Caption>
      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Engine</DisplayHeading>
      <p className="prose-serif mt-4 max-w-3xl text-ink-2">
        The real <code>cmd/compile</code> and <code>cmd/link</code>, compiled to WebAssembly, run in a worker in this tab. No server runs your code.
      </p>

      <details className="panel mt-6 max-w-3xl" data-testid="engine-differences">
        <summary className="panel-head cursor-pointer">
          <span className="label">How this differs from go run on your machine</span>
        </summary>
        <ul className="grid gap-2 p-4 font-mono text-[0.78rem] leading-relaxed text-ink-2 [&_code]:bg-paper-2 [&_code]:px-1 [&_code]:text-ink">
          <li>
            <span className="text-ink">Data races usually stay hidden.</span> Unsynchronized writes from many goroutines often give the right answer here, while native Go loses updates.
          </li>
          <li>
            <span className="text-ink">Stack traces are shorter.</span> File paths are trimmed (<code>main.go:9</code>) and PC offsets differ; function names and line numbers match.
          </li>
          {Object.values(LOCAL_ONLY).map((f) => (
            <li key={f.label}>
              <span className="text-ink">Not here: {f.label}.</span> {f.why[0].toUpperCase() + f.why.slice(1)}. On your machine: <code>{f.command}</code>
            </li>
          ))}
        </ul>
      </details>

      <EngineLab />
    </Page>
  );
}
