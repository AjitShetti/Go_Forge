import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Caption, Page, DisplayHeading } from "@/components/ui";
import { pickCard } from "@/lib/review/cards";
import { answeredCards } from "@/lib/review/history.server";
import { loadLearner, relativeDays } from "../learner";
import { LearnerGate, StatusChip } from "../status";
import { ReviewCardView } from "./review-card";

export const dynamic = "force-dynamic";

type Params = { concept: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { concept } = await params;
  return { title: `Review · ${concept}` };
}

export default async function ConceptReviewPage({ params }: { params: Promise<Params> }) {
  const { concept } = await params;
  const view = await loadLearner();
  const info = view.content.concepts.find((c) => c.slug === concept);
  if (!info) notFound();

  return (
    <Page>
      <Caption className="pt-10">
        <Link href="/review" className="hover:text-accent">
          Review
        </Link>{" "}
        · {info.moduleCode} · {info.slug}
      </Caption>
      <DisplayHeading className="mt-6 text-[clamp(1.8rem,5vw,3.4rem)]">{info.title}</DisplayHeading>

      {view.kind !== "ok" ? (
        <LearnerGate view={view} what="review" />
      ) : (
        (() => {
          const state = view.states.find((s) => s.concept === concept)!;
          const answered = answeredCards(view.history);
          const card = pickCard(view.content.cards, concept, answered);
          return (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-3" data-testid="concept-state">
                <StatusChip status={state.status} />
                <span className="font-mono text-[0.75rem] text-ink-2">
                  {state.errorCount} {state.errorCount === 1 ? "mistake" : "mistakes"} · next review {relativeDays(state.nextReview, view.now)}
                </span>
              </div>
              {state.status !== "mastered" && state.status !== "new" && (
                <p className="label mt-3 normal-case" data-testid="mastery-missing">
                  To master this concept: {!state.rule.laterFirstTryCorrect && "get a new question on it right on the first try"}
                  {!state.rule.laterFirstTryCorrect && !state.rule.challengePassedWithoutSolution && ", and "}
                  {!state.rule.challengePassedWithoutSolution && "pass a challenge that uses it without revealing the solution"}
                  {state.rule.laterFirstTryCorrect && state.rule.challengePassedWithoutSolution && "keep your latest answer on it correct"}.
                </p>
              )}
              {card ? (
                <ReviewCardView
                  // Keyed by when it was last answered too: when a concept has one card,
                  // "Next question" picks the same card again and must still get a fresh form.
                  key={`${card.id}@${answered.get(card.id) ?? 0}`}
                  concept={concept}
                  goVersion={view.content.goVersion}
                  seenBefore={answered.has(card.id)}
                  card={{
                    id: card.id,
                    lessonTitle: card.lessonTitle,
                    lessonHref: `/track/${card.lessonRef.split("/")[1]}/${card.lessonRef.split("/")[2]}`,
                    code: card.code,
                    kind: card.kind,
                    question: card.question,
                    choices: card.choices,
                  }}
                />
              ) : (
                <p className="panel prose-serif mt-8 max-w-2xl p-5 text-ink-2" data-testid="no-cards">
                  No authored lesson has a verified program for this concept yet, so there's nothing honest to ask.
                </p>
              )}
            </>
          );
        })()
      )}
    </Page>
  );
}
