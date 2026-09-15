// Shared loading for /review and /dashboard: who is signed in, their history,
// and derived concept states, with every "can't show this" case made explicit.
import { reviewQueue } from "@/lib/review/mastery";
import { loadReviewContent, type ReviewContent } from "@/lib/review/content.server";
import { deriveAll, type LearnerHistory, loadHistory, syncMastery } from "@/lib/review/history.server";
import type { ConceptState } from "@/lib/review/mastery";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServer, getCurrentUser } from "@/lib/supabase/server";

export type LearnerView =
  | { kind: "not-configured"; content: ReviewContent }
  | { kind: "signed-out"; content: ReviewContent }
  | { kind: "error"; content: ReviewContent; message: string }
  | {
      kind: "ok";
      content: ReviewContent;
      now: number;
      history: LearnerHistory;
      states: ConceptState[];
      queue: ReturnType<typeof reviewQueue>;
      /** The mastery cache write failed; states are still correct (they're derived), just not saved. */
      syncError: string | null;
    };

export async function loadLearner(): Promise<LearnerView> {
  const content = loadReviewContent();
  if (!getSupabaseConfig()) return { kind: "not-configured", content };
  const user = await getCurrentUser();
  if (!user) return { kind: "signed-out", content };
  const supabase = (await createSupabaseServer())!;
  const now = Date.now();
  try {
    const history = await loadHistory(supabase, user.id);
    const states = deriveAll(content, history, now);
    let syncError: string | null = null;
    try {
      await syncMastery(supabase, user.id, states, history.conceptIds);
    } catch (e) {
      syncError = (e as Error).message;
    }
    return { kind: "ok", content, now, history, states, queue: reviewQueue(states, now), syncError };
  } catch (e) {
    return { kind: "error", content, message: (e as Error).message };
  }
}

/** "today", "in 3 days", "2 days ago", from whole days between two instants. */
export function relativeDays(t: number | null, now: number): string {
  if (t === null) return "never";
  const days = Math.round((t - now) / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
