import Link from "next/link";
import { Caption, Page, PixelHeading, Plate } from "@/components/ui";
import { track } from "@/lib/content/track";

const lessonCount = track.modules.reduce((n, m) => n + m.lessons.length, 0);

const TRAP = `a := make([]int, 3, 4)
b := append(a, 99)
c := append(a, 42)
fmt.Println(b[3], c[3])`;

export default function Home() {
  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-10">
        <Caption>FIG_000 · Curriculum v0.1 · 2026</Caption>
        <Caption className="text-blue">Runs in your browser · real Go toolchain</Caption>
      </div>

      <PixelHeading className="mt-10 text-[clamp(2.6rem,9vw,6.5rem)]">
        Go from
        <br />
        first principles
      </PixelHeading>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <div>
          <p className="prose-serif text-[1.35rem] leading-snug">
            {track.modules.length} modules. {lessonCount} lessons. Every topic starts with a program you will predict wrong, then shows you why.
          </p>
          <p className="prose-serif mt-4 text-ink-2 italic">Built for someone who thinks in Python and JavaScript. No syntax tables first.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href="/track" className="btn btn-primary">
              Start the track
            </Link>
            <Link href="/canvas" className="btn">
              Open design canvas
            </Link>
          </div>

          <div className="panel mt-8">
            <div className="panel-head">
              <span className="label">The loop</span>
            </div>
            <ol className="grid gap-px bg-rule sm:grid-cols-3">
              {["Provoke", "Collide", "Decode", "Rebuild", "Challenge", "Stretch"].map((s, i) => (
                <li key={s} className="bg-paper px-4 py-3 font-mono text-sm">
                  <span className="text-ink-3">0{i + 1}</span> {s}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <Plate caption="FIG_001 · Predict first" aside="len 3 · cap 4">
          <pre className="code-block">{TRAP}</pre>
          <p className="label mt-6 text-center normal-case tracking-[0.08em]">What does this print? You answer before the Run button unlocks.</p>
        </Plate>
      </div>
    </Page>
  );
}
