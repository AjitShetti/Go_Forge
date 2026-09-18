import type { Metadata } from "next";
import Link from "next/link";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { firstTries } from "@/lib/review/mastery";
import { type LearnerView, loadLearner, relativeDays } from "./learner";
import { LearnerGate, StatusChip } from "./status";

export const metadata: Metadata = { title: "Review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const view = await loadLearner();

  return (
    <Page>
      <Caption className="pt-10">Mistake ledger · review queue</Caption>
      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Review</DisplayHeading>
      <p className="prose-serif mt-4 max-w-2xl text-ink-2">
        Concepts come back here when you predict them wrong, and on a spaced schedule after that. Every question is a program the content pipeline actually ran, so the answer is what real Go printed.
      </p>
      {view.kind === "ok" ? <ReviewBody view={view} /> : <LearnerGate view={view} what="your review queue" />}
    </Page>
  );
}

function ReviewBody({ view }: { view: Extract<LearnerView, { kind: "ok" }> }) {
  const { queue, now, history, content, states, syncError } = view;
  const title = (slug: string) => content.concepts.find((c) => c.slug === slug)?.title ?? slug;
  const lessonOf = (ref: string) => content.lessons.find((l) => l.ref === ref);
  const firsts = new Set(firstTries(history.predictions));
  const mistakes = history.predictions.filter((p) => firsts.has(p) && !p.correct).reverse();
  const met = states.filter((s) => s.status !== "new");
  const mistakeTotal = met.reduce((n, s) => n + s.errorCount, 0);

  return (
    <>
      <p className="label mt-8" data-testid="review-summary">
        {queue.due.length} due now · {mistakeTotal} {mistakeTotal === 1 ? "mistake" : "mistakes"} logged · {met.filter((s) => s.status === "mastered").length} of {met.length}{" "}
        concepts met are mastered
      </p>
      {syncError && <p className="mt-2 font-mono text-xs text-bad">Mastery cache not saved: {syncError}</p>}

      <section className="panel mt-6" data-testid="due-now">
        <div className="panel-head">
          <h2 className="font-mono text-sm">Due now</h2>
          <span className="label">heaviest mistakes first</span>
        </div>
        {queue.due.length === 0 ? (
          <p className="prose-serif px-4 py-4 text-ink-2">
            {met.length === 0 ? "Nothing yet. Predictions you make in lessons land here, the wrong ones first." : "Nothing is due. The next scheduled review is below."}
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {queue.due.map((s) => (
              <li key={s.concept} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid={`due-${s.concept}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="prose-serif text-lg">{title(s.concept)}</span>
                  <StatusChip status={s.status} />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-mono text-[0.75rem] text-ink-2">
                    {s.errorCount} {s.errorCount === 1 ? "mistake" : "mistakes"} · last wrong {relativeDays(s.lastWrongAt, now)} · weight {s.mistakeWeight.toFixed(2)}
                  </span>
                  <Link href={`/review/${s.concept}`} className="btn btn-primary px-3 py-1.5 text-[0.8rem]" data-testid={`review-${s.concept}`}>
                    Review →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {queue.upcoming.length > 0 && (
        <section className="panel mt-6" data-testid="upcoming">
          <div className="panel-head">
            <h2 className="font-mono text-sm">Scheduled</h2>
            <span className="label">spaced repetition</span>
          </div>
          <ul className="divide-y divide-rule">
            {queue.upcoming.map((s) => (
              <li key={s.concept} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5" data-testid={`upcoming-${s.concept}`}>
                <span className="flex items-center gap-3">
                  <span className="prose-serif">{title(s.concept)}</span>
                  <StatusChip status={s.status} />
                </span>
                <span className="font-mono text-[0.75rem] text-ink-2">
                  next review {relativeDays(s.nextReview, now)} · interval {s.intervalDays} {s.intervalDays === 1 ? "day" : "days"} ·{" "}
                  <Link href={`/review/${s.concept}`} className="text-accent underline underline-offset-2">
                    review early
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel mt-6" data-testid="mistake-ledger">
        <div className="panel-head">
          <h2 className="font-mono text-sm">Mistake ledger</h2>
          <span className="label">
            {mistakes.length} wrong first {mistakes.length === 1 ? "try" : "tries"}
          </span>
        </div>
        {mistakes.length === 0 ? (
          <p className="prose-serif px-4 py-4 text-ink-2">No wrong predictions recorded.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {mistakes.map((m, i) => {
              const lesson = lessonOf(m.lessonRef);
              return (
                <li key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]" data-testid="mistake">
                  <span className="font-mono text-[0.75rem] text-ink-3">{relativeDays(m.at, now)}</span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2">
                      {m.concept && <span className="border border-rule px-1.5 py-0.5 font-mono text-[0.68rem] text-ink-2">{m.concept}</span>}
                      <span className="font-mono text-[0.72rem] text-ink-3">{m.source === "trap" ? "lesson trap" : "review question"}</span>
                      {lesson && (
                        <Link href={`/track/${lesson.moduleSlug}/${lesson.lessonSlug}`} className="prose-serif text-accent underline underline-offset-2">
                          {lesson.title}
                        </Link>
                      )}
                    </p>
                    <pre className="code-block mt-1 max-h-24 overflow-hidden text-ink-2">you said: {m.text}</pre>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
