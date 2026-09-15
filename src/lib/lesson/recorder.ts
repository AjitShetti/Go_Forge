"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { view, type LessonEvent, type LessonState } from "./machine";

/** Extra data that belongs in a record but not in the replayable event stream. */
export type RecordExtras = {
  code?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  status?: string;
  ms?: number;
  failedCases?: string[];
};

export type SaveStatus = { kind: "not-saved"; reason: string } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export interface LessonRecorder {
  readonly persistent: boolean;
  load(): Promise<LessonEvent[]>;
  record(from: LessonState, to: LessonState, event: LessonEvent, extras?: RecordExtras): void;
  onStatus(cb: (s: SaveStatus) => void): void;
}

/** Used when Supabase is unconfigured or the learner is signed out. Persists nothing, and says so. */
export class NullRecorder implements LessonRecorder {
  readonly persistent = false;
  constructor(private reason: string) {}
  async load() {
    return [];
  }
  record() {}
  onStatus(cb: (s: SaveStatus) => void) {
    cb({ kind: "not-saved", reason: this.reason });
  }
}

/**
 * Writes each accepted transition to lesson_events (the replayable log) and
 * lesson_progress, plus the domain tables for the events that produce them:
 * predictions, runs, challenge_attempts, notebook. Writes are serialized so
 * the event log keeps its order.
 */
export class SupabaseRecorder implements LessonRecorder {
  readonly persistent = true;
  private queue: Promise<void> = Promise.resolve();
  private listeners: ((s: SaveStatus) => void)[] = [];
  private pending = 0;

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    private lessonId: string,
    private trapConceptId: string | null,
  ) {}

  onStatus(cb: (s: SaveStatus) => void) {
    this.listeners.push(cb);
    cb({ kind: "saved" });
  }

  private emit(s: SaveStatus) {
    for (const l of this.listeners) l(s);
  }

  async load(): Promise<LessonEvent[]> {
    const { data, error } = await this.supabase
      .from("lesson_events")
      .select("payload")
      .eq("lesson_id", this.lessonId)
      .order("id", { ascending: true });
    if (error) throw new Error(`loading progress: ${error.message}`);
    return (data ?? []).map((r) => r.payload as LessonEvent);
  }

  record(from: LessonState, to: LessonState, event: LessonEvent, extras: RecordExtras = {}) {
    this.pending++;
    this.emit({ kind: "saving" });
    this.queue = this.queue
      .then(() => this.write(from, to, event, extras))
      .then(
        () => {
          if (--this.pending === 0) this.emit({ kind: "saved" });
        },
        (e: Error) => {
          this.pending--;
          this.emit({ kind: "error", message: e.message });
        },
      );
  }

  private async write(from: LessonState, to: LessonState, event: LessonEvent, x: RecordExtras) {
    const db = this.supabase;
    const base = { user_id: this.userId, lesson_id: this.lessonId };
    const check = ({ error }: { error: { message: string } | null }, what: string) => {
      if (error) throw new Error(`${what}: ${error.message}`);
    };

    check(await db.from("lesson_events").insert({ ...base, from_state: from.step, to_state: to.step, event: event.type, payload: event }), "lesson_events");

    const v = view(to);
    check(
      await db.from("lesson_progress").upsert(
        { ...base, state: to.step, completed: v.completed, marked_for_review: v.markedForReview, updated_at: new Date(event.at).toISOString() },
        { onConflict: "user_id,lesson_id" },
      ),
      "lesson_progress",
    );

    switch (event.type) {
      case "TRAP_RESULT":
        check(await db.from("predictions").insert({ ...base, concept_id: this.trapConceptId, text: to.prediction ?? "", correct: event.correct }), "predictions");
        check(await db.from("runs").insert(this.run("collide", x)), "runs");
        break;
      case "REBUILD_RUN":
        check(await db.from("runs").insert(this.run("rebuild", x)), "runs");
        break;
      case "CHALLENGE_RESULT":
        check(
          await db.from("challenge_attempts").insert({
            ...base,
            code: x.code ?? "",
            passed: event.passed,
            failed_cases: event.failedCases,
            hints_used: to.hintsRevealed,
            solution_revealed: to.solutionRevealed,
            duration_ms: from.challengeStartedAt ? event.at - from.challengeStartedAt : null,
          }),
          "challenge_attempts",
        );
        break;
      case "SUBMIT_STRETCH":
        check(await db.from("notebook").insert({ ...base, kind: "stretch", body: event.body }), "notebook");
        break;
    }
  }

  private run(step: string, x: RecordExtras) {
    return {
      user_id: this.userId,
      lesson_id: this.lessonId,
      step,
      code: x.code ?? "",
      stdout: x.stdout ?? "",
      stderr: x.stderr ?? "",
      exit_code: x.exitCode ?? null,
      status: x.status ?? "unknown",
      ms: x.ms ?? null,
    };
  }
}
