// Server-only. Reads a learner's history under RLS and keeps the mastery cache
// in sync with what deriveConcept() computes from it.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewContent } from "./content.server";
import { type AttemptRecord, type ConceptState, deriveConcept, type PredictionRecord, questionKey } from "./mastery";

export type ProgressRecord = { lessonRef: string; completed: boolean; markedForReview: boolean; state: string };

/** A wrong first-try prediction, for the mistake ledger. */
export type MistakeRecord = PredictionRecord & { text: string };

export type LearnerHistory = {
  predictions: (PredictionRecord & { text: string })[];
  attempts: AttemptRecord[];
  progress: ProgressRecord[];
  conceptIds: Map<string, string>;
  lessonIds: Map<string, string>;
};

// PostgREST returns an embedded to-one relation as an object.
type Ref<K extends string> = { [P in K]: string } | null;

export async function loadHistory(supabase: SupabaseClient, userId: string): Promise<LearnerHistory> {
  const [preds, attempts, progress, concepts, lessons] = await Promise.all([
    supabase.from("predictions").select("text, correct, source, created_at, lessons(content_ref), concepts(slug)").eq("user_id", userId).order("created_at"),
    supabase.from("challenge_attempts").select("passed, solution_revealed, created_at, lessons(content_ref)").eq("user_id", userId).order("created_at"),
    supabase.from("lesson_progress").select("state, completed, marked_for_review, lessons(content_ref)").eq("user_id", userId),
    supabase.from("concepts").select("id, slug"),
    supabase.from("lessons").select("id, content_ref"),
  ]);
  for (const r of [preds, attempts, progress, concepts, lessons]) if (r.error) throw new Error(`loading review history: ${r.error.message}`);

  return {
    predictions: (preds.data ?? []).map((p) => ({
      lessonRef: (p.lessons as unknown as Ref<"content_ref">)?.content_ref ?? "",
      concept: (p.concepts as unknown as Ref<"slug">)?.slug ?? null,
      source: p.source,
      correct: p.correct,
      text: p.text,
      at: Date.parse(p.created_at),
    })),
    attempts: (attempts.data ?? []).map((a) => ({
      lessonRef: (a.lessons as unknown as Ref<"content_ref">)?.content_ref ?? "",
      passed: a.passed,
      solutionRevealed: a.solution_revealed,
      at: Date.parse(a.created_at),
    })),
    progress: (progress.data ?? []).map((p) => ({
      lessonRef: (p.lessons as unknown as Ref<"content_ref">)?.content_ref ?? "",
      completed: p.completed,
      markedForReview: p.marked_for_review,
      state: p.state,
    })),
    conceptIds: new Map((concepts.data ?? []).map((c) => [c.slug, c.id])),
    lessonIds: new Map((lessons.data ?? []).map((l) => [l.content_ref, l.id])),
  };
}

export function deriveAll(content: ReviewContent, history: LearnerHistory, now: number): ConceptState[] {
  return content.concepts.map((c) => deriveConcept(c.slug, c.lessons, history.predictions, history.attempts, now));
}

/**
 * Writes the derived state of every concept the learner has met into the
 * mastery table. The table is a cache: deriveAll() is the source of truth.
 */
export async function syncMastery(supabase: SupabaseClient, userId: string, states: ConceptState[], conceptIds: Map<string, string>) {
  const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());
  const rows = states
    .filter((s) => s.status !== "new" && conceptIds.has(s.concept))
    .map((s) => ({
      user_id: userId,
      concept_id: conceptIds.get(s.concept)!,
      state: s.status,
      streak: s.streak,
      ease: s.ease,
      interval_days: s.intervalDays,
      error_count: s.errorCount,
      last_seen: iso(s.lastSeen),
      next_review: iso(s.nextReview),
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("mastery").upsert(rows, { onConflict: "user_id,concept_id" });
  if (error) throw new Error(`saving mastery: ${error.message}`);
}

/**
 * When each question was last answered, keyed like card ids, for pickCard().
 * A trap answered in its lesson counts as its "#trap" card having been answered.
 */
export function answeredCards(history: LearnerHistory): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of history.predictions) {
    const key = questionKey(p);
    out.set(key, Math.max(out.get(key) ?? 0, p.at));
  }
  return out;
}
