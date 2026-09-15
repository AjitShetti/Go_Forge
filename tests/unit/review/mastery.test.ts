import { describe, expect, it } from "vitest";
import { type AttemptRecord, DAY_MS, deriveConcept, firstTries, type PredictionRecord, reviewQueue, sm2 } from "@/lib/review/mastery";

const T0 = Date.UTC(2026, 8, 1);
const day = (n: number) => T0 + n * DAY_MS;
const L1 = "go/m3-slices-maps/slice-aliasing";
const L2 = "go/m3-slices-maps/slicing-shares-memory";
const pred = (lessonRef: string, correct: boolean, at: number, source = "trap", concept = "slice-header"): PredictionRecord => ({ lessonRef, concept, source, correct, at });
const attempt = (lessonRef: string, passed: boolean, at: number, solutionRevealed = false): AttemptRecord => ({ lessonRef, passed, solutionRevealed, at });

describe("sm2", () => {
  it("grows the interval 1 → 3 → interval × ease on successes", () => {
    let s = { streak: 0, ease: 2.5, intervalDays: 0 };
    const intervals = [];
    for (let i = 0; i < 4; i++) {
      s = sm2(s, 4);
      intervals.push(s.intervalDays);
    }
    expect(intervals).toEqual([1, 3, 8, 20]);
    expect(s.ease).toBe(2.5);
  });

  it("a lapse resets the streak and interval and lowers ease, never below 1.3", () => {
    let s = sm2({ streak: 3, ease: 2.5, intervalDays: 8 }, 1);
    expect(s).toEqual({ streak: 0, ease: 1.96, intervalDays: 1 });
    for (let i = 0; i < 10; i++) s = sm2(s, 0);
    expect(s.ease).toBe(1.3);
  });
});

describe("firstTries", () => {
  it("keeps the earliest prediction per lesson and source", () => {
    const a = pred(L1, false, day(0));
    const b = pred(L1, true, day(1));
    const c = pred(L1, true, day(2), "review:x");
    expect(firstTries([b, c, a])).toEqual([a, c]);
  });
});

describe("deriveConcept", () => {
  it("is new with no history", () => {
    const s = deriveConcept("slice-header", [L1], [], [], day(0));
    expect(s.status).toBe("new");
    expect(s.nextReview).toBeNull();
  });

  it("a wrong prediction is a mistake due tomorrow", () => {
    const s = deriveConcept("slice-header", [L1], [pred(L1, false, day(0))], [], day(0));
    expect(s).toMatchObject({ status: "learning", errorCount: 1, lastWrongAt: day(0), nextReview: day(1), mistakeWeight: 1 });
  });

  it("mistake weight halves every 7 days and adds up across mistakes", () => {
    const history = [pred(L1, false, day(0)), pred(L2, false, day(7))];
    expect(deriveConcept("slice-header", [L1, L2], history, [], day(14)).mistakeWeight).toBe(0.75);
  });

  it("ignores predictions tagged with other concepts and attempts in unrelated lessons", () => {
    const s = deriveConcept("slice-header", [L1], [pred(L1, false, day(0), "trap", "nil-map")], [attempt("go/x/y", true, day(1))], day(2));
    expect(s.status).toBe("new");
  });

  it("repeating an answered question schedules but is not an error and not mastery evidence", () => {
    const history = [pred(L1, true, day(0)), pred(L1, false, day(1))];
    const s = deriveConcept("slice-header", [L1], history, [attempt(L1, true, day(0))], day(2));
    expect(s.errorCount).toBe(0);
    expect(s.status).toBe("learning");
  });

  describe("mastery rule", () => {
    const passClean = attempt(L1, true, day(0));

    it("needs a correct first try on a different question after the first one", () => {
      const onlyOne = deriveConcept("slice-header", [L1], [pred(L1, true, day(0))], [passClean], day(1));
      expect(onlyOne.status).not.toBe("mastered");
      expect(onlyOne.rule).toEqual({ laterFirstTryCorrect: false, challengePassedWithoutSolution: true });

      const later = deriveConcept("slice-header", [L1, L2], [pred(L1, false, day(0)), pred(L2, true, day(3))], [passClean], day(4));
      expect(later.status).toBe("mastered");
    });

    it("a review card counts as a different question, even from the same lesson", () => {
      const s = deriveConcept("slice-header", [L1], [pred(L1, false, day(0)), pred(L1, true, day(2), "review:go/m3-slices-maps/slice-aliasing#same-array")], [passClean], day(3));
      expect(s.status).toBe("mastered");
    });

    it("re-answering the lesson's own trap as a review card is the same question, not new evidence", () => {
      const preds = [pred(L1, false, day(0)), pred(L1, true, day(2), "review:go/m3-slices-maps/slice-aliasing#trap")];
      const s = deriveConcept("slice-header", [L1], preds, [passClean], day(3));
      expect(s.rule.laterFirstTryCorrect).toBe(false);
      expect(s.errorCount).toBe(1);
      expect(s.status).not.toBe("mastered");
    });

    it("needs a challenge passed before the solution was ever shown", () => {
      const preds = [pred(L1, true, day(0)), pred(L2, true, day(2))];
      const gaveUp = [attempt(L1, false, day(0)), attempt(L1, false, day(0) + 1000, true), attempt(L1, true, day(0) + 2000, true)];
      const s = deriveConcept("slice-header", [L1, L2], preds, gaveUp, day(3));
      expect(s.rule.challengePassedWithoutSolution).toBe(false);
      expect(s.status).not.toBe("mastered");
      expect(deriveConcept("slice-header", [L1, L2], preds, [attempt(L2, true, day(2))], day(3)).status).toBe("mastered");
    });

    it("a newer mistake takes mastery away", () => {
      const preds = [pred(L1, true, day(0)), pred(L2, true, day(2)), pred(L1, false, day(5), "review:c")];
      const s = deriveConcept("slice-header", [L1, L2], preds, [passClean], day(6));
      expect(s.status).toBe("learning");
      expect(s.errorCount).toBe(1);
    });
  });

  it("a given-up challenge is a lapse in the schedule", () => {
    const s = deriveConcept("slice-header", [L1], [pred(L1, true, day(0))], [attempt(L1, false, day(1), true)], day(1));
    expect(s.streak).toBe(0);
    expect(s.nextReview).toBe(day(2));
  });
});

describe("reviewQueue", () => {
  it("lists due concepts first by mistake weight, then upcoming by date, and hides new ones", () => {
    const now = day(10);
    const base = { streak: 0, ease: 2.5, intervalDays: 1, errorCount: 0, lastSeen: 0, lastWrongAt: null, rule: { laterFirstTryCorrect: false, challengePassedWithoutSolution: false } };
    const states = [
      { ...base, concept: "a", status: "learning" as const, nextReview: day(9), mistakeWeight: 0.2 },
      { ...base, concept: "b", status: "learning" as const, nextReview: day(8), mistakeWeight: 1.5 },
      { ...base, concept: "c", status: "review" as const, nextReview: day(12), mistakeWeight: 0 },
      { ...base, concept: "d", status: "new" as const, nextReview: null, mistakeWeight: 0 },
    ];
    const q = reviewQueue(states, now);
    expect(q.due.map((e) => e.concept)).toEqual(["b", "a"]);
    expect(q.upcoming.map((e) => e.concept)).toEqual(["c"]);
  });
});
