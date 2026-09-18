import type { Metadata } from "next";
import Link from "next/link";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { track } from "@/lib/content/track";
import { firstTries } from "@/lib/review/mastery";
import { type LearnerView, loadLearner, relativeDays } from "../review/learner";
import { LearnerGate, StatusChip } from "../review/status";

export const metadata: Metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const view = await loadLearner();
  return (
    <Page>
      <Caption className="pt-10">Progress</Caption>
      <DisplayHeading className="mt-6 text-[clamp(2rem,6vw,4rem)]">Progress</DisplayHeading>
      {view.kind === "ok" ? <DashboardBody view={view} /> : <LearnerGate view={view} what="your progress" />}
    </Page>
  );
}

function DashboardBody({ view }: { view: Extract<LearnerView, { kind: "ok" }> }) {
  const { content, history, states, queue, now } = view;
  const stateOf = (slug: string) => states.find((s) => s.concept === slug)!;
  const progressOf = (ref: string) => history.progress.find((p) => p.lessonRef === ref);

  const authored = content.lessons.filter((l) => l.authored);
  const completed = authored.filter((l) => progressOf(l.ref)?.completed).length;
  const firsts = firstTries(history.predictions);
  const firstCorrect = firsts.filter((p) => p.correct).length;
  const cleanPasses = new Set(history.attempts.filter((a) => a.passed && !a.solutionRevealed).map((a) => a.lessonRef)).size;
  const byStatus = (s: string) => states.filter((c) => c.status === s).length;

  const facts: [string, string, string][] = [
    ["lessons-completed", "Lessons completed", `${completed} of ${authored.length} authored (${content.lessons.length} planned)`],
    ["first-try-accuracy", "First-try predictions right", firsts.length === 0 ? "no predictions yet" : `${firstCorrect} of ${firsts.length}`],
    ["clean-passes", "Challenges passed without the solution", `${cleanPasses}`],
    ["concepts", "Concepts", `${byStatus("mastered")} mastered · ${byStatus("review")} in review · ${byStatus("learning")} learning · ${byStatus("new")} not met`],
    ["due", "Reviews due now", `${queue.due.length}`],
  ];

  return (
    <>
      <dl className="panel mt-8 divide-y divide-rule" data-testid="progress-facts">
        {facts.map(([id, label, value]) => (
          <div key={id} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[22rem_1fr]" data-testid={`fact-${id}`}>
            <dt className="label">{label}</dt>
            <dd className="font-mono text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      {queue.due.length > 0 && (
        <p className="mt-3">
          <Link href="/review" className="btn btn-primary px-3 py-1.5 text-[0.8rem]">
            Go to review →
          </Link>
        </p>
      )}

      <div className="mt-8 grid gap-6">
        {track.modules.map((m) => {
          const moduleLessons = content.lessons.filter((l) => l.moduleCode === m.code);
          const concepts = [...new Set(m.lessons.flatMap((l) => l.concepts))];
          return (
            <section key={m.slug} className="panel" data-testid={`progress-${m.code}`}>
              <div className="panel-head">
                <h2 className="font-mono text-sm">
                  <span className="text-accent">{m.code}</span> · {m.title}
                </h2>
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
    </>
  );
}
