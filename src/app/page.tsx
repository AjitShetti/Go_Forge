import Link from "next/link";
import { CanvasDemo } from "@/components/home/canvas-demo";
import { Caption, Page, DisplayHeading, Plate } from "@/components/ui";
import { track } from "@/lib/content/track";
import { abs, jsonLdScript, ORGANIZATION, SITE_NAME } from "@/lib/seo";

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
  ["Stretch", "An open question with no grade. Your answer stays with the lesson."],
];

const STATS: [string, string][] = [
  [String(track.modules.length), "modules, in order"],
  [String(lessonCount), "lessons"],
  ["6", "steps in every lesson"],
  ["0", "installs: Go compiles in your browser"],
];

const PLACES: { n: string; title: string; href: string; link: string; text: string }[] = [
  { n: "01", title: "Learn", href: "/track", link: "Track", text: `${track.modules.length} modules in order. Each lesson runs the loop below, with real Go compiled in your browser.` },
  {
    n: "02",
    title: "Review",
    href: "/review",
    link: "Review",
    text: "Every prediction you get wrong comes back as a review card, then again on a spaced schedule until it sticks - next to what you've finished and what you've mastered.",
  },
  { n: "03", title: "Design", href: "/scenarios", link: "Scenarios", text: "Pick a system to build, sketch it on the canvas, and grade it against the scenario's load and constraints." },
];

const HOME_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    ORGANIZATION,
    {
      "@type": "WebSite",
      "@id": abs("/#website"),
      url: abs("/"),
      name: SITE_NAME,
      description: "Learn Go from first principles by predicting, failing, and decoding, with real Go compiled in your browser.",
      inLanguage: "en",
      publisher: { "@id": abs("/#organization") },
    },
    {
      "@type": "Course",
      "@id": abs("/track#course"),
      url: abs("/track"),
      name: track.title,
      description: `A ${track.modules.length}-module Go course in ${lessonCount} lessons, for developers who already write Python or JavaScript.`,
      provider: { "@id": abs("/#organization") },
      isAccessibleForFree: true,
      inLanguage: "en",
      hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: `PT${lessonCount}H` },
    },
  ],
};

export default function Home() {
  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(HOME_JSON_LD)} />
      {/* ------------------------------------------------------------ hero --- */}
      <section className="relative pt-14 sm:pt-20">
        {/* Four-column grid, drawn: the page is set on it. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden grid-cols-4 sm:grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-l border-rule/60 last:border-r" />
          ))}
        </div>

        <Caption>A Go course for Python and JavaScript developers</Caption>
        <DisplayHeading className="mt-8 text-[clamp(2.6rem,8.4vw,6.4rem)]">
          Go from
          <br />
          first principles<span className="text-accent">.</span>
        </DisplayHeading>

        <div className="mt-14 grid gap-12 lg:grid-cols-2">
          <div className="max-w-xl">
            <p className="text-[1.3rem] leading-[1.5] text-ink">
              Every topic starts with a program you will predict wrong. Then you find out why, in the runtime, the compiler and the memory model.
            </p>
            <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-2">Built for someone who already thinks in Python and JavaScript. No syntax tables first.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/track" className="btn btn-primary">
                Start the track
              </Link>
              <Link href="/canvas" className="btn">
                Open design canvas
              </Link>
            </div>
            <p className="mt-6 text-[0.9rem] text-ink-3">
              New here?{" "}
              <a href="#how-it-works" className="text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent">
                See how it works
              </a>{" "}
              or{" "}
              <a href="#canvas-walkthrough" className="text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent">
                watch a design get graded
              </a>
              .
            </p>
          </div>

          <Plate caption="Predict first" aside="len 3 · cap 4" className="self-start">
            <pre className="code-block text-[0.92rem]">{TRAP}</pre>
            <p className="mt-6 border-t border-rule pt-4 text-[0.88rem] text-ink-3">What does this print? You answer before the Run button unlocks.</p>
          </Plate>
        </div>

        <dl className="mt-20 grid grid-cols-2 border-y border-rule sm:grid-cols-4">
          {STATS.map(([value, label]) => (
            <div key={label} className="border-rule px-4 py-6 odd:border-r sm:border-r sm:last:border-r-0">
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-none font-extrabold text-accent">{value}</dd>
              <dd className="mt-2 text-[0.88rem] text-ink-2">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------ how it works --- */}
      <section id="how-it-works" className="mt-32 scroll-mt-20" data-testid="how-it-works">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <Caption>Getting started</Caption>
            <DisplayHeading as="h2" className="mt-5 text-[clamp(2rem,4.6vw,3.4rem)]">
              How to use it
            </DisplayHeading>
          </div>
          <p className="max-w-xl text-[1.02rem] leading-relaxed text-ink-2">
            Lessons, the canvas and the engine all work signed out. Sign in to keep your predictions, progress and designs; Review needs an account.
          </p>
        </div>

        <ol className="mt-12 border-t border-line">
          {PLACES.map((p) => (
            <li key={p.n} className="group relative border-b border-rule">
              <Link href={p.href} className="grid gap-x-8 gap-y-2 py-7 transition-colors hover:bg-paper sm:grid-cols-[3rem_10rem_1fr_auto] sm:items-baseline sm:px-4">
                <span className="font-mono text-[0.85rem] text-accent">{p.n}</span>
                <h3 className="font-display text-[1.6rem] leading-none font-extrabold">{p.title}</h3>
                <p className="max-w-xl text-[1rem] leading-relaxed text-ink-2">{p.text}</p>
                <span className="text-[0.9rem] font-semibold whitespace-nowrap text-ink-2 transition-colors group-hover:text-accent">
                  Open {p.link} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
              <span aria-hidden className="absolute top-0 bottom-0 left-0 w-0.5 origin-top scale-y-0 bg-accent transition-transform group-hover:scale-y-100" />
            </li>
          ))}
        </ol>

        {/* The six steps, drawn as the pipeline they are. */}
        <div className="mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h3 className="font-display text-[1.35rem] font-extrabold">Inside a lesson: the loop</h3>
            <span className="text-[0.88rem] text-ink-3">Each step unlocks the next</span>
          </div>
          <ol className="relative mt-10 grid gap-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-6">
            <span aria-hidden className="absolute top-[7px] right-0 left-0 hidden h-px bg-line lg:block" />
            {LOOP.map(([name, text], i) => (
              <li key={name} className="relative">
                <span aria-hidden className={`relative block h-[15px] w-[15px] border-2 border-accent ${i === 0 ? "bg-accent" : "bg-ground"}`} />
                <p className="mt-5 font-mono text-[0.78rem] text-accent">0{i + 1}</p>
                <p className="mt-1 font-display text-[1.1rem] font-extrabold">{name}</p>
                <p className="mt-2 text-[0.93rem] leading-relaxed text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------- canvas walkthrough --- */}
      <section id="canvas-walkthrough" className="mt-32 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Caption>Design canvas</Caption>
            <DisplayHeading as="h2" className="mt-5 text-[clamp(2rem,4.6vw,3.4rem)]">
              See the system,
              <br />
              then grade it
            </DisplayHeading>
          </div>
          <Link href="/canvas" className="btn">
            Open the canvas →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 text-[1.02rem] leading-relaxed text-ink-2 lg:grid-cols-2">
          <p>
            Boxes are components, arrows are calls. Each arrow has a kind: a solid line waits for a reply, a dashed one is fire-and-forget, a double rail copies data. Each box carries the numbers that
            matter: replicas, requests per second, latency, storage.
          </p>
          <p>
            Press Grade and a fixed set of rules pushes the scenario&apos;s load through your diagram. It shows where it breaks and the arithmetic behind each finding. Below is one design, fixed a step at
            a time. The scores are the grader&apos;s real output.
          </p>
        </div>
        <div className="mt-10">
          <CanvasDemo />
        </div>
      </section>
    </Page>
  );
}
