"use server";

import { gradeCard, reviewSource } from "@/lib/review/cards";
import { loadReviewContent } from "@/lib/review/content.server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServer, getCurrentUser } from "@/lib/supabase/server";

export type ReviewAnswerResult =
  | { ok: true; correct: boolean; answer: string; real: { stdout: string; stderr: string; exitCode: number } }
  | { ok: false; error: string };

/**
 * Records a review answer. Grading happens here, on the server, against the
 * verified output: the client never receives the answer before it commits.
 */
export async function submitReviewAnswer(input: { cardId: string; concept: string; answer: string }): Promise<ReviewAnswerResult> {
  if (!getSupabaseConfig()) return { ok: false, error: "Supabase is not configured, so nothing can be saved." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are signed out." };
  if (input.answer.trim() === "") return { ok: false, error: "Make a prediction first." };

  const content = loadReviewContent();
  const card = content.cards.find((c) => c.id === input.cardId);
  if (!card || !card.concepts.includes(input.concept)) return { ok: false, error: "Unknown review card." };
  if (card.kind === "choice" && !card.choices?.includes(input.answer)) return { ok: false, error: "Pick one of the options." };

  const supabase = (await createSupabaseServer())!;
  const [lesson, concept] = await Promise.all([
    supabase.from("lessons").select("id").eq("content_ref", card.lessonRef).maybeSingle(),
    supabase.from("concepts").select("id").eq("slug", input.concept).maybeSingle(),
  ]);
  if (!lesson.data || !concept.data) return { ok: false, error: `Lesson or concept is not seeded in the database (${card.lessonRef}, ${input.concept}).` };

  const correct = gradeCard(card, input.answer);
  const { error } = await supabase.from("predictions").insert({
    lesson_id: lesson.data.id,
    concept_id: concept.data.id,
    text: input.answer,
    correct,
    source: reviewSource(card.id),
  });
  if (error) return { ok: false, error: `Could not save your answer: ${error.message}` };

  // No revalidatePath: it would re-render this page, pick the next card and
  // unmount the result before the learner sees it. The review pages are
  // dynamic; "Next question" refreshes explicitly.
  return { ok: true, correct, answer: card.answer, real: card.real };
}
