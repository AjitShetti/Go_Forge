// Concept mastery and review scheduling, derived from history (spec §4).
//
// Nothing here is stored as truth. The mastery table is a cache of
// deriveConcept() over the learner's predictions and challenge attempts, so
// the rules can change and every learner's state is simply recomputed.
// Pure: no I/O, no clock (callers pass `now`). Erasable TypeScript.

export const DAY_MS = 24 * 60 * 60 * 1000;
/** A wrong prediction's weight in the mistake ledger halves every this many days. */
export const MISTAKE_HALF_LIFE_DAYS = 7;
export const START_EASE = 2.5;
export const MIN_EASE = 1.3;

export type ConceptStatus = "new" | "learning" | "review" | "mastered";

/** One predictions row. `source` is "trap" for a lesson's Provoke, "review:<cardId>" for a review card. */
export type PredictionRecord = {
  lessonRef: string;
  concept: string | null;
  source: string;
  correct: boolean;
  at: number;
};

/** One challenge_attempts row. */
export type AttemptRecord = {
  lessonRef: string;
  passed: boolean;
  solutionRevealed: boolean;
  at: number;
};

export type ConceptState = {
  concept: string;
  status: ConceptStatus;
  /** Consecutive successful reviews (SM-2 repetitions). */
  streak: number;
  ease: number;
  intervalDays: number;
  /** Wrong first-try predictions tagged with this concept. */
  errorCount: number;
  lastSeen: number | null;
  nextReview: number | null;
  lastWrongAt: number | null;
  /** Sum over wrong predictions of 0.5^(age / half-life): recent and repeated mistakes weigh most. */
  mistakeWeight: number;
  /** The two conditions of the mastery rule, so the UI can say which one is missing. */
  rule: { laterFirstTryCorrect: boolean; challengePassedWithoutSolution: boolean };
};

type ReviewEvent = { at: number; quality: number; wrongPrediction: boolean };

/**
 * SM-2 step. quality is 0–5; below 3 is a lapse.
 * Intervals go 1 day, 3 days, then previous interval × ease.
 */
export function sm2(prev: { streak: number; ease: number; intervalDays: number }, quality: number) {
  const q = Math.max(0, Math.min(5, quality));
  const ease = Math.max(MIN_EASE, round2(prev.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
  if (q < 3) return { streak: 0, ease, intervalDays: 1 };
  const streak = prev.streak + 1;
  const intervalDays = streak === 1 ? 1 : streak === 2 ? 3 : Math.max(1, Math.round(prev.intervalDays * prev.ease));
  return { streak, ease, intervalDays };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The question a prediction answered. A lesson's trap and the review card made
 * from that same trap are one question: "<lessonRef>#trap".
 */
export function questionKey(p: Pick<PredictionRecord, "lessonRef" | "source">): string {
  return p.source.startsWith("review:") ? p.source.slice("review:".length) : `${p.lessonRef}#${p.source}`;
}

/** Keeps only the first prediction per question: later ones answer something already seen. */
export function firstTries<T extends PredictionRecord>(predictions: T[]): T[] {
  const seen = new Set<string>();
  return [...predictions]
    .sort((a, b) => a.at - b.at)
    .filter((p) => {
      const key = questionKey(p);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Derives one concept's state.
 *
 * Review events, in time order:
 *  - a prediction tagged with the concept: quality 4 if correct, 1 if wrong.
 *    Repeats of an already-answered source still schedule, but never count
 *    as errors or toward mastery.
 *  - the first challenge outcome in each lesson touching the concept:
 *    a pass with the solution never shown is quality 4; an attempt made after
 *    the solution was shown (give-up or reveal) is a lapse, quality 2.
 *
 * Mastery (spec §4) needs both:
 *  A. a correct first-try prediction, tagged with the concept, made after the
 *     concept's first prediction and on a different question (another
 *     lesson's trap or a review card), and
 *  B. a passed challenge, in a lesson touching the concept, with the solution
 *     never shown.
 * A newer wrong prediction takes mastery away again until A holds anew.
 */
export function deriveConcept(
  concept: string,
  lessonsTouching: readonly string[],
  predictions: PredictionRecord[],
  attempts: AttemptRecord[],
  now: number,
): ConceptState {
  const all = predictions.filter((p) => p.concept === concept).sort((a, b) => a.at - b.at);
  const firsts = new Set(firstTries(all));
  const touching = new Set(lessonsTouching);

  const events: ReviewEvent[] = all.map((p) => ({
    at: p.at,
    quality: p.correct ? 4 : 1,
    wrongPrediction: !p.correct && firsts.has(p),
  }));

  const byLesson = new Map<string, AttemptRecord[]>();
  for (const a of attempts) {
    if (!touching.has(a.lessonRef)) continue;
    byLesson.set(a.lessonRef, [...(byLesson.get(a.lessonRef) ?? []), a]);
  }
  let challengePassedWithoutSolution = false;
  for (const list of byLesson.values()) {
    const sorted = [...list].sort((a, b) => a.at - b.at);
    const cleanPass = sorted.find((a) => a.passed && !a.solutionRevealed);
    const revealed = sorted.find((a) => a.solutionRevealed);
    if (cleanPass && (!revealed || cleanPass.at < revealed.at)) {
      challengePassedWithoutSolution = true;
      events.push({ at: cleanPass.at, quality: 4, wrongPrediction: false });
    } else if (revealed) {
      events.push({ at: revealed.at, quality: 2, wrongPrediction: false });
    }
  }
  events.sort((a, b) => a.at - b.at);

  let sched = { streak: 0, ease: START_EASE, intervalDays: 0 };
  let errorCount = 0;
  let mistakeWeight = 0;
  let lastWrongAt: number | null = null;
  let lastSeen: number | null = null;
  let nextReview: number | null = null;
  for (const e of events) {
    sched = sm2(sched, e.quality);
    lastSeen = e.at;
    nextReview = e.at + sched.intervalDays * DAY_MS;
    if (e.wrongPrediction) {
      errorCount++;
      lastWrongAt = e.at;
      mistakeWeight += Math.pow(0.5, Math.max(0, now - e.at) / (MISTAKE_HALF_LIFE_DAYS * DAY_MS));
    }
  }

  const orderedFirsts = all.filter((p) => firsts.has(p));
  const first = orderedFirsts[0];
  const lastPrediction = all[all.length - 1];
  const laterFirstTryCorrect =
    first !== undefined &&
    orderedFirsts.some((p) => p.correct && p.at > first.at && questionKey(p) !== questionKey(first)) &&
    // Demotion: the most recent prediction on this concept must not be a mistake.
    lastPrediction.correct;

  let status: ConceptStatus;
  if (events.length === 0) status = "new";
  else if (laterFirstTryCorrect && challengePassedWithoutSolution) status = "mastered";
  else if (sched.streak >= 2) status = "review";
  else status = "learning";

  return {
    concept,
    status,
    streak: sched.streak,
    ease: sched.ease,
    intervalDays: sched.intervalDays,
    errorCount,
    lastSeen,
    nextReview,
    lastWrongAt,
    mistakeWeight: Math.round(mistakeWeight * 1000) / 1000,
    rule: { laterFirstTryCorrect, challengePassedWithoutSolution },
  };
}

export type QueueEntry = ConceptState & { due: boolean };

/**
 * The review queue: every concept the learner has met, due ones first.
 * Within each group, heavier mistake weight first, then the earliest review date.
 */
export function reviewQueue(states: ConceptState[], now: number): { due: QueueEntry[]; upcoming: QueueEntry[] } {
  const met = states.filter((s) => s.status !== "new");
  const entries = met.map((s) => ({ ...s, due: s.nextReview !== null && s.nextReview <= now }));
  const order = (a: QueueEntry, b: QueueEntry) => b.mistakeWeight - a.mistakeWeight || (a.nextReview ?? 0) - (b.nextReview ?? 0) || a.concept.localeCompare(b.concept);
  return { due: entries.filter((e) => e.due).sort(order), upcoming: entries.filter((e) => !e.due).sort((a, b) => (a.nextReview ?? 0) - (b.nextReview ?? 0) || a.concept.localeCompare(b.concept)) };
}
