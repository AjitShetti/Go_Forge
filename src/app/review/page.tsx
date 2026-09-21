import type { Metadata } from "next";
import Link from "next/link";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { track } from "@/lib/content/track";
import { firstTries } from "@/lib/review/mastery";
import { type LearnerView, loadLearner, relativeDays } from "./learner";
import { LearnerGate, StatusChip } from "./status";

export const metadata: Metadata = { title: "Review" };
export const dynamic = "force-dynamic";

/**
 * Everything about one learner, on one page: what is due, what is scheduled, how
 * far through the track they are, and what they have got wrong.
 *
 * This was two pages, /review and /dashboard, which both called loadLearner() and
 * rendered halves of the same object - so reading either one left you to guess at
 * the other. They are ordered here by what a learner opens the page to find out:
 * what to do now first, the record of how it is going after it.
 */
export default async function ReviewPage() {
  const view = await loadLearner();

  return (
    <Page>
      <Caption className="pt-10">Review queue · progress · mistake ledger</Caption>
      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Review</DisplayHeading>
      <p className="prose-serif mt-4 max-w-2xl text-ink-2">
        Concepts come back here when you predict them wrong, and on a spaced schedule after that. Every question is a program the content pipeline actually ran, so the answer is what real Go printed.
      </p>
      {view.kind === "ok" ? <ReviewBody view={view} /> : <LearnerGate view={view} what="your review queue and progress" />}
    </Page>
  );
}

function ReviewBody({ view }: { view: Extract<LearnerView, { kind: "ok" }> }) {
  const { queue, now, history, content, states, syncError } = view;
  const title = (slug: string) => content.concepts.find((c) => c.slug === slug)?.title ?? slug;
  const lessonOf = (ref: string) => content.lessons.find((l) => l.ref === ref);
  const stateOf = (slug: string) => states.find((s) => s.concept === slug)!;
  const progressOf = (ref: string) => history.progress.find((p) => p.lessonRef === ref);

  const firsts = new Set(firstTries(history.predictions));
  const mistakes = history.predictions.filter((p) => firsts.has(p) && !p.correct).reverse();
  const met = states.filter((s) => s.status !== "new");
  const mistakeTotal = met.reduce((n, s) => n + s.errorCount, 0);

  const authored = content.lessons.filter((l) => l.authored);
  const completed = authored.filter((l) => progressOf(l.ref)?.completed).length;
  const firstList = firstTries(history.predictions);
  const firstCorrect = firstList.filter((p) => p.correct).length;
  const cleanPasses = new Set(history.attempts.filter((a) => a.passed && !a.solutionRevealed).map((a) => a.lessonRef)).size;
  const byStatus = (s: string) => states.filter((c) => c.status === s).length;

  // "Reviews due now" is deliberately not a row here: it is the heading of the very
  // next section, and repeating it was the most obvious seam when the pages merged.
  const facts: [string, string, string][] = [
    ["lessons-completed", "Lessons completed", `${completed} of ${authored.length} authored (${content.lessons.length} planned)`],
    ["first-try-accuracy", "First-try predictions right", firstList.length === 0 ? "no predictions yet" : `${firstCorrect} of ${firstList.length}`],
    ["clean-passes", "Challenges passed without the solution", `${cleanPasses}`],
    ["concepts", "Concepts", `${byStatus("mastered")} mastered · ${byStatus("review")} in review · ${byStatus("learning")} learning · ${byStatus("new")} not met`],
  ];

  return (
    <>
      <p className="label mt-8" data-testid="review-summary">
        {queue.due.length} due now · {completed} of {authored.length} lessons done · {mistakeTotal} {mistakeTotal === 1 ? "mistake" : "mistakes"} logged · {byStatus("mastered")} of {met.length}{" "}
        concepts met are mastered
      </p>
      {syncError && <p className="mt-2 font-mono text-xs text-bad">Mastery cache not saved: {syncError}</p>}

      {/* ------------------------------------------------------ what to do now --- */}
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

      {/* --------------------------------------------------------- how it goes --- */}
      <h2 className="mt-14 font-display text-[1.35rem] font-extrabold">Progress</h2>
      <dl className="panel mt-4 divide-y divide-rule" data-testid="progress-facts">
        {facts.map(([id, label, value]) => (
          <div key={id} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[22rem_1fr]" data-testid={`fact-${id}`}>
            <dt className="label">{label}</dt>
            <dd className="font-mono text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6">
        {track.modules.map((m) => {
          const moduleLessons = content.lessons.filter((l) => l.moduleCode === m.code);
          const concepts = [...new Set(m.lessons.flatMap((l) => l.concepts))];
          return (
            <section key={m.slug} className="panel" data-testid={`progress-${m.code}`}>
              <div className="panel-head">
                <h3 className="font-mono text-sm">
                  <span className="text-accent">{m.code}</span> · {m.title}
                </h3>
                <span className="label">
                  {moduleLessons.filter((l) => progressOf(l.ref)?.completed).length} / {moduleLessons.length} done
                </span>
              </div>
              <ul className="divide-y divide-rule">
                {moduleLessons.map((l) => {
                  const p = progressOf(l.ref);
                  const status = !l.authored ? "not authored" : p?.completed ? "completed" : p?.markedForReview ? "gave up · marked for review" : p ? `in progress · ${p.state}` : "not started";
                  return (
                    <li key={l.ref} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2" data-testid={`lesson-${l.lessonSlug}`} data-status={status}>
                      {l.authored ? (
                        <Link href={`/track/${l.moduleSlug}/${l.lessonSlug}`} className="prose-serif hover:text-accent">
                          {l.title}
                        </Link>
                      ) : (
                        <span className="prose-serif text-ink-3">{l.title}</span>
                      )}
                      <span className={`font-mono text-[0.72rem] ${p?.completed ? "text-ok" : p?.markedForReview ? "text-bad" : "text-ink-3"}`}>{status}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-2 border-t border-rule px-4 py-3">
                {concepts.map((c) => {
                  const s = stateOf(c);
                  return (
                    <span key={c} className="flex items-center gap-1.5" title={s.nextReview ? `next review ${relativeDays(s.nextReview, now)}` : "not met yet"} data-testid={`concept-${c}`}>
                      <span className="font-mono text-[0.72rem] text-ink-2">{c}</span>
                      <StatusChip status={s.status} />
                    </span>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* ------------------------------------------------------- what went wrong --- */}
      <section className="panel mt-14" data-testid="mistake-ledger">
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
