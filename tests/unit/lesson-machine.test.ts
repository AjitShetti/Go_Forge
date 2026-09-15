import { describe, expect, it } from "vitest";
import { initialState, replay, transition, view, type LessonEvent, type LessonState } from "@/lib/lesson/machine";

let t = 1000;
const at = () => (t += 1000);

function run(events: Omit<LessonEvent, "at">[]): { state: LessonState; rejected: string[] } {
  let state = initialState;
  const rejected: string[] = [];
  for (const e of events) {
    const r = transition(state, { ...e, at: at() } as LessonEvent);
    if (!r.ok) rejected.push(`${e.type}: ${r.reason}`);
    state = r.state;
  }
  return { state, rejected };
}

const toChallenge: Omit<LessonEvent, "at">[] = [
  { type: "PREDICT", text: "99 42" },
  { type: "TRAP_RUN_STARTED" },
  { type: "TRAP_RESULT", observed: "42 42", correct: false },
  { type: "CONTINUE" },
  { type: "CONTINUE" },
  { type: "CONTINUE" },
];
const fail = { type: "CHALLENGE_RESULT", passed: false, failedCases: ["TestX/a"] } as const;

describe("prediction gate", () => {
  it("run is disabled until a prediction is locked in", () => {
    expect(view(initialState).canRunTrap).toBe(false);
    const { rejected } = run([{ type: "TRAP_RUN_STARTED" }]);
    expect(rejected).toEqual(["TRAP_RUN_STARTED: predict before running"]);
    const { state } = run([{ type: "PREDICT", text: "42 42" }]);
    expect(view(state).canRunTrap).toBe(true);
  });

  it("rejects empty predictions and changing a locked prediction", () => {
    const { state, rejected } = run([
      { type: "PREDICT", text: "   " },
      { type: "PREDICT", text: "first" },
      { type: "PREDICT", text: "second" },
    ]);
    expect(state.prediction).toBe("first");
    expect(rejected).toHaveLength(2);
  });

  it("the explanation stays hidden until after collide", () => {
    const { state, rejected } = run([{ type: "PREDICT", text: "x" }, { type: "TRAP_RUN_STARTED" }, { type: "EXPAND_SECTION", section: "Decode" }]);
    expect(view(state).showDecode).toBe(false);
    expect(rejected[0]).toMatch(/locked until after collide/);
    const after = run([...toChallenge.slice(0, 3)]).state;
    expect(after.step).toBe("collide");
    expect(view(after).showCollide).toBe(true);
    expect(view(after).showDecode).toBe(false);
    expect(view(run(toChallenge.slice(0, 4)).state).showDecode).toBe(true);
  });

  it("a failed engine run re-enables the trap without leaving provoke", () => {
    const { state } = run([{ type: "PREDICT", text: "x" }, { type: "TRAP_RUN_STARTED" }, { type: "TRAP_RUN_FAILED" }]);
    expect(state.step).toBe("provoke");
    expect(view(state).canRunTrap).toBe(true);
  });
});

describe("challenge", () => {
  it("cannot advance without passing or giving up", () => {
    const { state, rejected } = run([...toChallenge, fail, { type: "CONTINUE" }]);
    expect(state.step).toBe("challenge");
    expect(rejected.at(-1)).toMatch(/pass the challenge/);
  });

  it("hint 1 unlocks after 2 failed attempts, hint 2 after 4", () => {
    let { state, rejected } = run([...toChallenge, fail, { type: "REVEAL_HINT" }]);
    expect(rejected.at(-1)).toMatch(/hint 1 is still locked/);
    expect(view(state).failuresUntilNextHint).toBe(1);
    ({ state } = run([...toChallenge, fail, fail, { type: "REVEAL_HINT" }]));
    expect(state.hintsRevealed).toBe(1);
    ({ state, rejected } = run([...toChallenge, fail, fail, fail, { type: "REVEAL_HINT" }, { type: "REVEAL_HINT" }]));
    expect(state.hintsRevealed).toBe(1);
    expect(rejected.at(-1)).toMatch(/hint 2 is still locked/);
    ({ state } = run([...toChallenge, fail, fail, fail, fail, { type: "REVEAL_HINT" }, { type: "REVEAL_HINT" }]));
    expect(state.hintsRevealed).toBe(2);
    expect(view(state).failuresUntilNextHint).toBe(null);
  });

  it("the solution is locked until a pass or giving up", () => {
    let { rejected } = run([...toChallenge, fail, { type: "REVEAL_SOLUTION" }]);
    expect(rejected.at(-1)).toMatch(/solution unlocks/);
    const passed = run([...toChallenge, { type: "CHALLENGE_RESULT", passed: true, failedCases: [] }, { type: "REVEAL_SOLUTION" }]);
    expect(passed.state.solutionRevealed).toBe(true);
  });

  it("giving up reveals the solution and marks for review, never complete", () => {
    const { state } = run([...toChallenge, fail, { type: "GIVE_UP" }, { type: "CONTINUE" }, { type: "SKIP_STRETCH" }]);
    expect(state.step).toBe("complete");
    expect(view(state).showSolution).toBe(true);
    expect(view(state).markedForReview).toBe(true);
    expect(view(state).completed).toBe(false);
  });

  it("a pass after a pass does not un-pass", () => {
    const { state } = run([...toChallenge, { type: "CHALLENGE_RESULT", passed: true, failedCases: [] }, fail]);
    expect(state.passed).toBe(true);
    expect(state.attempts).toBe(2);
  });
});

describe("completion and replay", () => {
  const full: Omit<LessonEvent, "at">[] = [
    ...toChallenge,
    fail,
    { type: "CHALLENGE_RESULT", passed: true, failedCases: [] },
    { type: "CONTINUE" },
    { type: "SUBMIT_STRETCH", body: "shared array via s[1:3]" },
  ];

  it("passing without revealing the solution completes the lesson", () => {
    const { state, rejected } = run(full);
    expect(rejected).toEqual([]);
    expect(view(state).completed).toBe(true);
    expect(state.stretchSubmitted).toBe(true);
  });

  it("replaying persisted events reproduces the state exactly", () => {
    t = 1000;
    const events = full.map((e) => ({ ...e, at: at() }) as LessonEvent);
    const live = events.reduce((s, e) => transition(s, e).state, initialState);
    expect(replay(events)).toEqual(live);
  });

  it("decode time is accumulated between entering and leaving decode", () => {
    const events: LessonEvent[] = [
      { type: "PREDICT", text: "a", at: 1 },
      { type: "TRAP_RUN_STARTED", at: 2 },
      { type: "TRAP_RESULT", observed: "a", correct: true, at: 3 },
      { type: "CONTINUE", at: 10_000 },
      { type: "CONTINUE", at: 70_000 },
    ];
    expect(replay(events).decodeMs).toBe(60_000);
  });
});
