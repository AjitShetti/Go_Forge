// The lesson loop as an explicit, pure state machine (spec §4).
//
//   provoke → collide → decode → rebuild → challenge → stretch → complete
//
// All gating lives here, not in components: the Run button, the explanation,
// hints, the solution and advancing are all derived from state. The UI only
// dispatches events and renders `view(state)`. Every accepted event is also a
// persisted record (lesson_events), and replaying the stored events through
// `reduce` rebuilds the exact state - so resuming a lesson is a fold.

export const STEPS = ["provoke", "collide", "decode", "rebuild", "challenge", "stretch", "complete"] as const;
export type Step = (typeof STEPS)[number];

export const HINT_THRESHOLDS = [2, 4] as const; // failed attempts needed to unlock hint 1, hint 2

export type LessonState = {
  step: Step;
  prediction: string | null;
  trapRunning: boolean;
  trap: { observed: string; correct: boolean } | null;
  decodeOpenedAt: number | null;
  decodeMs: number;
  expandedSections: string[];
  rebuildRuns: number;
  rebuildGoalMet: boolean;
  challengeStartedAt: number | null;
  attempts: number;
  failedAttempts: number;
  hintsRevealed: number;
  passed: boolean;
  gaveUp: boolean;
  solutionRevealed: boolean;
  stretchSubmitted: boolean;
  /** The answer itself, so a lesson reopened later can show it back. */
  stretchBody: string | null;
};

export type LessonEvent =
  | { type: "PREDICT"; text: string; at: number }
  | { type: "TRAP_RUN_STARTED"; at: number }
  | { type: "TRAP_RESULT"; observed: string; correct: boolean; at: number }
  | { type: "TRAP_RUN_FAILED"; at: number }
  | { type: "CONTINUE"; at: number }
  | { type: "EXPAND_SECTION"; section: string; at: number }
  | { type: "REBUILD_RUN"; goalMet: boolean; at: number }
  | { type: "CHALLENGE_RESULT"; passed: boolean; failedCases: string[]; at: number }
  | { type: "REVEAL_HINT"; at: number }
  | { type: "GIVE_UP"; at: number }
  | { type: "REVEAL_SOLUTION"; at: number }
  | { type: "SUBMIT_STRETCH"; body: string; at: number }
  | { type: "SKIP_STRETCH"; at: number };

export const initialState: LessonState = {
  step: "provoke",
  prediction: null,
  trapRunning: false,
  trap: null,
  decodeOpenedAt: null,
  decodeMs: 0,
  expandedSections: [],
  rebuildRuns: 0,
  rebuildGoalMet: false,
  challengeStartedAt: null,
  attempts: 0,
  failedAttempts: 0,
  hintsRevealed: 0,
  passed: false,
  gaveUp: false,
  solutionRevealed: false,
  stretchSubmitted: false,
  stretchBody: null,
};

export type Transition = { ok: true; state: LessonState } | { ok: false; state: LessonState; reason: string };

const reject = (state: LessonState, reason: string): Transition => ({ ok: false, state, reason });
const accept = (state: LessonState): Transition => ({ ok: true, state });

export function transition(s: LessonState, e: LessonEvent): Transition {
  switch (e.type) {
    case "PREDICT":
      if (s.step !== "provoke") return reject(s, "predictions are only taken before running the trap");
      if (s.prediction !== null) return reject(s, "prediction already locked in");
      if (e.text.trim() === "") return reject(s, "prediction is empty");
      return accept({ ...s, prediction: e.text });

    case "TRAP_RUN_STARTED":
      if (s.step !== "provoke") return reject(s, "the trap runs once, from provoke");
      if (s.prediction === null) return reject(s, "predict before running");
      if (s.trapRunning) return reject(s, "trap already running");
      return accept({ ...s, trapRunning: true });

    case "TRAP_RUN_FAILED":
      if (!s.trapRunning) return reject(s, "trap is not running");
      return accept({ ...s, trapRunning: false });

    case "TRAP_RESULT":
      if (s.step !== "provoke" || !s.trapRunning) return reject(s, "no trap run in progress");
      return accept({ ...s, trapRunning: false, trap: { observed: e.observed, correct: e.correct }, step: "collide" });

    case "EXPAND_SECTION":
      if (!canSeeDecode(s)) return reject(s, "explanation is locked until after collide");
      if (s.expandedSections.includes(e.section)) return accept(s);
      return accept({ ...s, expandedSections: [...s.expandedSections, e.section] });

    case "CONTINUE":
      switch (s.step) {
        case "collide":
          return accept({ ...s, step: "decode", decodeOpenedAt: e.at });
        case "decode":
          return accept({ ...s, step: "rebuild", decodeMs: s.decodeMs + (s.decodeOpenedAt ? e.at - s.decodeOpenedAt : 0), decodeOpenedAt: null });
        case "rebuild":
          return accept({ ...s, step: "challenge", challengeStartedAt: e.at });
        case "challenge":
          if (!s.passed && !s.gaveUp) return reject(s, "pass the challenge (or give up) to move on");
          return accept({ ...s, step: "stretch" });
        default:
          return reject(s, `cannot continue from ${s.step}`);
      }

    case "REBUILD_RUN":
      if (s.step !== "rebuild") return reject(s, "rebuild runs only happen in rebuild");
      return accept({ ...s, rebuildRuns: s.rebuildRuns + 1, rebuildGoalMet: s.rebuildGoalMet || e.goalMet });

    case "CHALLENGE_RESULT":
      if (s.step !== "challenge") return reject(s, "not in the challenge");
      if (s.passed) return accept({ ...s, attempts: s.attempts + 1 });
      return accept({
        ...s,
        attempts: s.attempts + 1,
        failedAttempts: s.failedAttempts + (e.passed ? 0 : 1),
        passed: e.passed,
      });

    case "REVEAL_HINT": {
      if (s.step !== "challenge") return reject(s, "hints belong to the challenge");
      if (s.passed || s.gaveUp) return reject(s, "the challenge is over: the reference solution is available instead");
      if (s.hintsRevealed >= availableHints(s)) return reject(s, `hint ${s.hintsRevealed + 1} is still locked`);
      return accept({ ...s, hintsRevealed: s.hintsRevealed + 1 });
    }

    case "GIVE_UP":
      if (s.step !== "challenge") return reject(s, "nothing to give up on");
      if (s.passed) return reject(s, "already passed");
      if (s.gaveUp) return accept(s);
      return accept({ ...s, gaveUp: true, solutionRevealed: true });

    case "REVEAL_SOLUTION":
      if (!(s.passed || s.gaveUp)) return reject(s, "the solution unlocks after a passing attempt or giving up");
      return accept({ ...s, solutionRevealed: true });

    case "SUBMIT_STRETCH":
      if (s.step !== "stretch") return reject(s, "not in stretch");
      if (e.body.trim() === "") return reject(s, "stretch answer is empty");
      return accept({ ...s, stretchSubmitted: true, stretchBody: e.body, step: "complete" });

    case "SKIP_STRETCH":
      if (s.step !== "stretch") return reject(s, "not in stretch");
      return accept({ ...s, step: "complete" });
  }
}

/** Fold persisted events; events the machine rejects are ignored (they were never accepted live either). */
export function replay(events: LessonEvent[]): LessonState {
  return events.reduce((s, e) => transition(s, e).state, initialState);
}

const stepIndex = (s: Step) => STEPS.indexOf(s);

export function canSeeDecode(s: LessonState): boolean {
  return stepIndex(s.step) >= stepIndex("decode");
}

export function availableHints(s: LessonState): number {
  return HINT_THRESHOLDS.filter((t) => s.failedAttempts >= t).length;
}

/** Everything the UI is allowed to show or do, derived from state. */
export function view(s: LessonState) {
  const nextHint = HINT_THRESHOLDS[s.hintsRevealed];
  return {
    canPredict: s.step === "provoke" && s.prediction === null,
    canRunTrap: s.step === "provoke" && s.prediction !== null && !s.trapRunning,
    showCollide: stepIndex(s.step) >= stepIndex("collide"),
    showDecode: canSeeDecode(s),
    canContinue:
      s.step === "collide" || s.step === "decode" || s.step === "rebuild" || (s.step === "challenge" && (s.passed || s.gaveUp)),
    canRevealHint: s.step === "challenge" && !s.passed && !s.gaveUp && s.hintsRevealed < availableHints(s),
    failuresUntilNextHint: nextHint === undefined ? null : Math.max(0, nextHint - s.failedAttempts),
    canGiveUp: s.step === "challenge" && !s.passed && !s.gaveUp,
    canRevealSolution: (s.passed || s.gaveUp) && !s.solutionRevealed,
    showSolution: s.solutionRevealed,
    completed: s.step === "complete" && s.passed && !s.gaveUp,
    markedForReview: s.gaveUp,
  };
}
