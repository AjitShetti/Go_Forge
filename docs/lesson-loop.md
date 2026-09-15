# The lesson loop (P2)

## State machine: `src/lib/lesson/machine.ts`

```
provoke ──PREDICT──▶ provoke(locked) ──TRAP_RUN_STARTED──▶ running ──TRAP_RESULT──▶ collide
collide ──CONTINUE──▶ decode ──CONTINUE──▶ rebuild ──CONTINUE──▶ challenge
challenge ──CHALLENGE_RESULT(passed) or GIVE_UP──▶ may CONTINUE ──▶ stretch ──SUBMIT/SKIP──▶ complete
```

The machine is pure: `transition(state, event)` returns either the new state or a rejection with a reason. Every rule in spec §4 is enforced there, and components only render `view(state)`.

| Rule | Enforced by |
|---|---|
| Run is locked until a prediction exists | `TRAP_RUN_STARTED` is rejected without `prediction`; `view.canRunTrap` |
| A prediction can't change once locked | a second `PREDICT` is rejected |
| The explanation stays hidden until after collide | `DecodeStep` isn't rendered before step ≥ decode (not in the DOM); `EXPAND_SECTION` is rejected |
| Hint 1 after 2 failed attempts, hint 2 after 4 | `HINT_THRESHOLDS`; `REVEAL_HINT` is rejected while locked |
| Solution only after a pass or "I give up" | `REVEAL_SOLUTION` is rejected otherwise |
| Giving up marks the lesson for review, never complete | `view.completed` requires `passed && !gaveUp` |
| Can't leave the challenge without passing or giving up | `CONTINUE` is rejected |

## Persistence: `src/lib/lesson/recorder.ts`

Every accepted event is appended to `lesson_events` (payload = the event) and upserts `lesson_progress`. Some events also write domain rows:

- `TRAP_RESULT` writes `predictions` (with the trap's concept tag) and a `collide` row in `runs`
- `REBUILD_RUN` writes a `rebuild` row in `runs`
- `CHALLENGE_RESULT` writes `challenge_attempts` (code, failed cases, hints used, solution revealed, duration)
- `SUBMIT_STRETCH` writes `notebook`

**Resuming is a replay:** on load, the stored events are folded through the same `transition`. A run left in flight by a closed tab gets a `TRAP_RUN_FAILED` event.

When signed out or unconfigured, a `NullRecorder` is used and the page shows **NOT SAVED · reason**.

Mastery and SM-2 updates are P4.

## Challenge tests in the browser: `src/lib/content/harness.ts`

The learner's `challenge.go`, the hidden `challenge_test.go` and a generated `zz_harness.go` are compiled together. The harness is a `main` that calls `testing.Main` with `-test.v`. Per-case results are parsed from the verbose output. The same parser reads native `go test -v` output in the verifier.

## Verification

| Command | What it proves |
|---|---|
| `node scripts/verify-lesson.mjs content/go/m3-slices-maps/slice-aliasing` | Every program's output is identical between `go run`/`go test -v` and the browser engine. The trap answer equals verified output, and exactly one choice matches. The rebuild solution respects locked lines. The reference solution passes; the starter and both wrong solutions fail. Writes `expected.json`. |
| `npm test` | Machine rules and replay, lesson parser, locked-line and output comparison, harness generation and parsing, RLS (PGlite) |
| `npm run build && npm run verify:browser -- --only=p1,engine,p2,p2auth` | Real Edge against `next start`: the whole lesson via the UI (signed out), then signed in against live Supabase with reload/resume and row-level checks |
