import Link from "next/link";
import { CanvasDemo } from "@/components/home/canvas-demo";
import { Caption, Page, PixelHeading, Plate } from "@/components/ui";
import { track } from "@/lib/content/track";

const lessonCount = track.modules.reduce((n, m) => n + m.lessons.length, 0);

const TRAP = `a := make([]int, 3, 4)
b := append(a, 99)
c := append(a, 42)
fmt.Println(b[3], c[3])`;

const LOOP: [string, string][] = [
  ["Provoke", "Read a short program and lock in what you think it prints."],
  ["Collide", "Run it. Your prediction sits next to what Go really printed."],
  ["Decode", "Why it happened, with the Python and JavaScript contrast."],
  ["Rebuild", "Change the code until it meets a stated goal. Unlimited runs."],
  ["Challenge", "Write code that passes hidden tests. Two hints if you're stuck."],
  ["Stretch", "An open question with no grade. Your answer goes to the Notebook."],
];

const PLACES: { n: string; title: string; href: string; link: string; text: string }[] = [
  { n: "01", title: "Learn", href: "/track", link: "Track", text: `${track.modules.length} modules in order. Each lesson runs the loop below, with real Go compiled in your browser.` },
  { n: "02", title: "Review", href: "/review", link: "Review", text: "Every prediction you get wrong comes back as a review card, then again on a spaced schedule until it sticks." },
  { n: "03", title: "Progress", href: "/dashboard", link: "Progress", text: "Which lessons you've finished, which concepts you've mastered, and what's due for review." },
  { n: "04", title: "Design", href: "/scenarios", link: "Scenarios", text: "Pick a system to build, sketch it on the canvas, and grade it against the scenario's load and constraints." },
];

export default function Home() {
  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-10">
        <Caption>A Go course for Python and JavaScript developers</Caption>
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
          <p className="mt-4 font-mono text-[0.76rem] text-ink-2">
            New here?{" "}
            <a href="#how-it-works" className="text-blue underline underline-offset-2">
              See how it works
            </a>{" "}
            ·{" "}
            <a href="#canvas-walkthrough" className="text-blue underline underline-offset-2">
              Watch a design get graded
            </a>
          </p>
        </div>

        <Plate caption="Predict first" aside="len 3 · cap 4">
          <pre className="code-block">{TRAP}</pre>
          <p className="label mt-6 text-center normal-case tracking-[0.08em]">What does this print? You answer before the Run button unlocks.</p>
        </Plate>
      </div>

      {/* ------------------------------------------------------ how it works --- */}
      <section id="how-it-works" className="mt-24 scroll-mt-8" data-testid="how-it-works">
        <Caption>Getting started</Caption>
        <PixelHeading as="h2" className="mt-4 text-[clamp(1.6rem,4vw,2.6rem)]">
          How to use it
        </PixelHeading>
        <p className="prose-serif mt-4 max-w-2xl text-ink-2">
          Lessons, the canvas and the engine all work signed out. Sign in to keep your predictions, progress, designs and notes; Review and Progress need an account.
        </p>

        <ol className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
          {PLACES.map((p) => (
            <li key={p.n} className="flex flex-col bg-paper p-4">
              <div className="flex items-baseline gap-3">
                <span className="font-pixel text-2xl font-bold text-blue">{p.n}</span>
                <h3 className="font-mono text-sm tracking-[0.16em] uppercase">{p.title}</h3>
              </div>
              <p className="prose-serif mt-2 flex-1 text-[1rem] leading-snug text-ink-2">{p.text}</p>
              <Link href={p.href} className="label mt-3 text-blue hover:underline">
                Open {p.link} →
              </Link>
            </li>
          ))}
        </ol>

        <div className="panel mt-8">
          <div className="panel-head">
            <span className="label">Inside a lesson · the loop</span>
            <span className="font-mono text-[0.7rem] text-ink-3">each step unlocks the next</span>
          </div>
          <ol className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {LOOP.map(([name, text], i) => (
              <li key={name} className="bg-paper px-4 py-3">
                <p className="font-mono text-sm">
                  <span className="text-ink-3">0{i + 1}</span> {name}
                </p>
                <p className="prose-serif mt-1 text-[0.98rem] leading-snug text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------- canvas walkthrough --- */}
      <section id="canvas-walkthrough" className="mt-24 scroll-mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Caption>Design canvas</Caption>
          <Link href="/canvas" className="label text-blue hover:underline">
            Open the canvas →
          </Link>
        </div>
        <PixelHeading as="h2" className="mt-4 text-[clamp(1.6rem,4vw,2.6rem)]">
          See the system, then grade it
        </PixelHeading>
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <p className="prose-serif text-ink-2">
            Boxes are components, arrows are calls. Each arrow has a kind: a solid line waits for a reply, a dashed one is fire-and-forget, a double rail copies data. Each box carries the numbers
            that matter: replicas, requests per second, latency, storage.
          </p>
          <p className="prose-serif text-ink-2">
            Press Grade and a fixed set of rules pushes the scenario&apos;s load through your diagram. It shows where it breaks and the arithmetic behind each finding. Below is one design, fixed a step at
            a time. The scores are the grader&apos;s real output.
          </p>
        </div>
        <div className="mt-8">
          <CanvasDemo />
        </div>
      </section>
    </Page>
  );
}
