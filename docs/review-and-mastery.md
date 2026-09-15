# Review, mistake ledger and mastery (P4)

Nothing about a learner's progress is stored as truth. Concept state is **derived** from two history tables the lesson player writes (`predictions`, `challenge_attempts`) by a pure function, `deriveConcept` in `src/lib/review/mastery.ts`. The `mastery` table is a cache of that function's output, rewritten whenever `/review` or `/dashboard` loads. If a rule changes, every learner's state is recomputed from their history, and no data migration is needed.

```
lesson player (P2) ──writes──► predictions (source 'trap'), challenge_attempts
review cards (P4)  ──writes──► predictions (source 'review:<lesson>#<block>')
                                   │
                         deriveConcept() per concept  ──cache──► mastery
                                   │
                    /review (queue + ledger)   /review/<concept>   /dashboard
```

## Review questions come only from verified programs

`src/lib/review/cards.ts` builds questions from each lesson's `expected.json`, which means from programs the content pipeline actually ran. No answer is typed by hand.

- A Decode program that exits 0 and prints at most 6 lines becomes a **type the exact output** card. Output is compared after trimming trailing whitespace, with the same `normalizeForCompare` the lesson player uses.
- Any other Decode program (compile error, panic, deadlock) becomes a **what happens?** choice among four outcomes. The outcome is classified from the recorded exit code and stderr.
- The lesson's **trap** becomes a choice card with the lesson's own options.
- **Skipped:** compile-only blocks (`mode=build`: the answer would be compiler diagnostics), nondeterministic blocks, and blocks that diverge from real Go.

For a concept, `pickCard` serves a question the learner has never answered, Decode programs first, then the trap. Once all are answered, it serves the one answered longest ago.

Grading happens in the server action (`src/app/review/actions.ts`). The browser receives the program and the question, but **not the answer or the output**, until the answer is committed. The e2e check confirms the answer text is absent from the page HTML before submission.

## Scheduling (SM-2)

These are the review events for a concept, in time order:

- A **prediction tagged with the concept**: quality 4 if correct, 1 if wrong.
- In each lesson touching the concept, the **challenge outcome**: a pass before the solution was ever shown is quality 4. An attempt after the solution was shown (give-up or reveal) is quality 2, a lapse.

`sm2()` folds them: a success extends the interval 1 day → 3 days → previous × ease, and a lapse resets the interval to 1 day and lowers ease (never below 1.3). `next_review = last event + interval`. A concept is **due** when `next_review <= now`.

## Mistake ledger

A mistake is a **wrong first try**: the first prediction on a question, where a question is a lesson trap or a review card, and a lesson's trap and its review card count as the same question. Each mistake adds `0.5^(age / 7 days)` to the concept's **mistake weight**, so recent and repeated mistakes weigh most. `/review` lists due concepts heaviest-first, then the scheduled ones, then every wrong first try with what you said.

## Mastery rule and interpretation decisions

The spec (§4): *"mastered only when: prediction correct on first try in a later lesson touching the same tag, AND its challenge passed without full-solution reveal."*

Implemented as both of these:

- **A.** A correct first-try prediction tagged with the concept, made **after** the concept's first prediction, on a **different question**.
- **B.** A challenge in a lesson touching the concept, passed before its solution was ever shown.

Three interpretation choices, confirmed by the project owner on 2026-09-15:

1. **A review card counts as "a later lesson".** Many concepts appear in only one lesson in M0–M3 (e.g. `integer-division`, `nil-map`). Read literally, the rule would make them unmasterable until M7+. A review card is a new, verified program on the same concept, answered after the first encounter, so it counts. The lesson's own trap re-asked as a card does not.
2. **Mastery can be lost.** A newer wrong prediction on the concept removes mastery until A holds again. The spec doesn't say whether mastery is permanent.
3. **Traps only tag one concept.** A lesson with two concepts (e.g. `slice-header` + `append-aliasing`) tags its trap prediction with `trap.concept` only, as the P2 player stores it. The other concept gets predictions through review cards, which can be served for either concept of the lesson.

## Files

- `src/lib/review/mastery.ts`: `sm2`, `firstTries`, `questionKey`, `deriveConcept`, `reviewQueue` (pure)
- `src/lib/review/cards.ts`: `lessonCards`, `outcomeOf`, `gradeCard`, `pickCard` (pure)
- `src/lib/review/content.server.ts`: cards and concept → lesson maps from `content/`
- `src/lib/review/history.server.ts`: loads history under RLS, `syncMastery` upserts the cache
- `src/app/review/*`: `/review`, `/review/[concept]`, the server action, shared gates
- `src/app/dashboard/page.tsx`: `/dashboard` ("Progress" in the nav)
- `supabase/migrations/20260915000200_prediction_source.sql`: `predictions.source`
- Tests: `tests/unit/review/*` (pure rules, cards on real content), `tests/db/review.test.ts` (migration, check constraint, RLS, mastery upsert on PGlite), `scripts/verify-p4.mjs` (browser, live Supabase)

## Known limits

- History is read with default PostgREST limits (1000 rows per table). That's fine for one learner through M12. Page it if it's ever exceeded.
- The mastery cache is written during a page render. If that write fails, the page still shows the derived state and prints the error; it doesn't hide it.
- Review cards exist only for authored lessons. A concept whose lessons aren't authored yet shows "nothing honest to ask".
