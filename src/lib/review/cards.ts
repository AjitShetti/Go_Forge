// Review cards: "what does this do?" questions built only from programs the
// content pipeline actually ran (expected.json). A card's answer is never
// written by hand. Pure. Erasable TypeScript.

import type { ParsedLesson } from "@/lib/content/lesson";
import { normalizeForCompare, observedOutput } from "@/lib/content/lesson";

export type RealResult = { stdout: string; stderr: string; exitCode: number };

export type ExpectedBlock = { mode: string; compare: string; real: RealResult; diverges?: boolean };

export type ExpectedJson = { blocks: Record<string, ExpectedBlock> };

/** What a program does, for programs whose output is not a short text answer. */
export const OUTCOMES = ["Compiles and runs normally", "Does not compile", "Compiles, then panics at run time", "Compiles, then deadlocks"] as const;

export type ReviewCard = {
  /** "<contentRef>#<block id>", e.g. "go/m3-slices-maps/nil-maps#map-is-a-pointer". Stored in predictions.source as "review:<id>". */
  id: string;
  lessonRef: string;
  lessonTitle: string;
  concepts: string[];
  blockId: string;
  code: string;
  /** output: type the exact output. choice: pick one of `choices`. */
  kind: "output" | "choice";
  question: string;
  choices?: string[];
  /** Normalized expected answer: output text, or the correct choice text. */
  answer: string;
  real: RealResult;
};

const MAX_OUTPUT_LINES = 6;

/** Classifies a verified run into one of OUTCOMES, or null if it fits none of them. */
export function outcomeOf(r: RealResult): (typeof OUTCOMES)[number] | null {
  if (r.exitCode === 0) return OUTCOMES[0];
  if (r.exitCode === 1 && /^\.\/\S+\.go:\d+:\d+: /.test(r.stderr)) return OUTCOMES[1];
  if (r.exitCode === 2 && r.stderr.startsWith("fatal error: all goroutines are asleep - deadlock!")) return OUTCOMES[3];
  if (r.exitCode === 2 && r.stderr.startsWith("panic: ")) return OUTCOMES[2];
  return null;
}

/**
 * Cards for one lesson: the lesson's own verified Decode programs first (new to
 * the learner at review time), then its trap (already seen once in the lesson).
 * Skipped: compile-only blocks (answers are compiler diagnostics),
 * nondeterministic blocks, and blocks that diverge from real Go.
 */
export function lessonCards(input: {
  lessonRef: string;
  lessonTitle: string;
  concepts: string[];
  lesson: ParsedLesson;
  expected: ExpectedJson;
  trapCode: string;
}): ReviewCard[] {
  const { lessonRef, lessonTitle, concepts, lesson, expected, trapCode } = input;
  const cards: ReviewCard[] = [];

  const fromBlock = (blockId: string, code: string): ReviewCard | null => {
    const block = expected.blocks[blockId];
    if (!block || block.mode !== "run" || block.compare !== "exact" || block.diverges) return null;
    const base = { id: `${lessonRef}#${blockId}`, lessonRef, lessonTitle, concepts, blockId, code, real: block.real };
    const out = normalizeForCompare(block.real.stdout);
    if (block.real.exitCode === 0 && out !== "" && out.split("\n").length <= MAX_OUTPUT_LINES) {
      return { ...base, kind: "output", question: "What does this print? Type the exact output.", answer: out };
    }
    const outcome = outcomeOf(block.real);
    if (!outcome) return null;
    return { ...base, kind: "choice", question: "What happens when you run this?", choices: [...OUTCOMES], answer: outcome };
  };

  for (const f of lesson.fences) {
    if (f.lang !== "go" || !f.meta.verified || typeof f.meta.id !== "string") continue;
    const card = fromBlock(f.meta.id, f.code);
    if (card) cards.push(card);
  }

  const trap = lesson.frontmatter.trap;
  const trapBlock = expected.blocks.trap;
  if (trapBlock && trap.kind === "choice" && trap.choices && trapBlock.compare === "exact") {
    cards.push({
      id: `${lessonRef}#trap`,
      lessonRef,
      lessonTitle,
      concepts,
      blockId: "trap",
      code: trapCode,
      kind: "choice",
      question: trap.question,
      choices: trap.choices,
      answer: normalizeForCompare(observedOutput(trapBlock.real)),
      real: trapBlock.real,
    });
  }
  return cards;
}

/** Grades a review answer. Choices compare by text, so shuffling the options can't break grading. */
export function gradeCard(card: ReviewCard, answer: string): boolean {
  return normalizeForCompare(answer) === normalizeForCompare(card.answer);
}

/**
 * Picks the next card for a concept: a card the learner has never answered,
 * in lesson and card order; otherwise the one answered longest ago.
 */
export function pickCard(cards: ReviewCard[], concept: string, answeredAt: Map<string, number>): ReviewCard | null {
  const candidates = cards.filter((c) => c.concepts.includes(concept));
  if (candidates.length === 0) return null;
  const fresh = candidates.find((c) => !answeredAt.has(c.id));
  if (fresh) return fresh;
  return [...candidates].sort((a, b) => (answeredAt.get(a.id) ?? 0) - (answeredAt.get(b.id) ?? 0))[0];
}

export const reviewSource = (cardId: string) => `review:${cardId}`;
export const cardIdFromSource = (source: string) => (source.startsWith("review:") ? source.slice("review:".length) : null);
