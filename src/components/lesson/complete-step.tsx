"use client";

import Link from "next/link";
import { Plate } from "@/components/ui";
import { view, type LessonState } from "@/lib/lesson/machine";

export function CompleteStep({ state, persistent }: { state: LessonState; persistent: boolean }) {
  const v = view(state);
  const rows: [string, string][] = [
    ["Prediction", state.trap?.correct ? "correct" : "wrong: logged to your mistake ledger"],
    ["Decode time", `${Math.round(state.decodeMs / 1000)} s`],
    ["Rebuild", `${state.rebuildRuns} runs · goal ${state.rebuildGoalMet ? "met" : "not met"}`],
    ["Challenge", `${state.attempts} attempts · ${state.hintsRevealed} hints · ${state.gaveUp ? "gave up" : "passed"}`],
    ["Stretch", state.stretchSubmitted ? "saved to notebook" : "skipped"],
  ];
  return (
    <section data-testid="step-complete">
      <Plate caption="FIG_END · Lesson summary" aside={v.completed ? "complete" : "marked for review"}>
        <p className={`font-pixel text-3xl font-bold uppercase ${v.completed ? "text-blue" : "text-warn"}`} data-testid="completion" data-completed={v.completed}>
          {v.completed ? "Lesson complete" : "Marked for review"}
        </p>
        <dl className="mt-5 grid gap-2 font-mono text-sm sm:grid-cols-[10rem_1fr]">
          {rows.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="label">{k}</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
        {!persistent && <p className="mt-5 font-mono text-sm text-bad">None of this was saved. Sign in with Supabase configured to keep your progress.</p>}
        <Link href="/track" className="btn btn-primary mt-6">
          Back to the track
        </Link>
      </Plate>
    </section>
  );
}
