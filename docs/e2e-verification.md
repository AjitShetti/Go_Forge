# Whole-app verification (P0–P4)

Every check runs in real Microsoft Edge (headless) against `next start`. The signed-in parts run against the live Supabase project as `e2e@goforge.test`.

```
npx tsc --noEmit && npm test && npm run build
# run supabase/e2e-reset.sql first (the scripts refuse a dirty test user)
npm run verify:browser -- --only=p1,engine,p2,p2auth
npm run verify:p4
npm run verify:e2e
```

The suites touch different lessons and concepts, so one reset covers all three:

| Suite | Lesson | Concept |
|---|---|---|
| p2auth | slice-aliasing | none |
| p4 | none | nil-map |
| e2e | integer-division | integer-division, toolchain |

## What `verify:e2e` adds

| Part | Checks |
|---|---|
| A · public surface | Every route returns 200. Unauthored, unknown and path-traversal lessons return 404. The auth callback with no code, a bogus token, or `next=//evil.example` never leaves the site. `GET /auth/signout` is 405. The login error parameter is escaped. An invalid email is blocked by the form. An unreachable auth service gives an error, not a stuck button. |
| B · engine | `syscall/js` is refused. `os.Exit(3)` and `panic(error)` match `go run`. UTF-8 survives chunking. Output floods hit the 1 MiB cap and the engine recovers. An empty file is a compile error. When the engine binaries can't be fetched, the lesson shows an error and Run stays disabled. |
| C · full lesson | Prediction gate: no run before a prediction, a locked prediction can't be changed, Decode isn't in the DOM. A double-click runs the trap once. A locked-line edit is refused and not recorded. Challenge: a compile error, a wrong answer and an infinite loop are each failed attempts; hint 1 unlocks at 2 failures; progress is kept across a reload mid-challenge; the pass records hints used. A blank stretch answer is refused. Every stored row is checked. |
| D · mastery | learning → mastered (a later correct first try plus a clean pass) → demoted by a newer wrong answer → mastered again. The review answer isn't in the page before answering. The dashboard agrees. |
| E · single-card concept | "Next question" gives a fresh form flagged "seen before". |
| F · RLS attacks | These are all refused: writing as another user, flipping a wrong prediction to correct, deleting events or attempts, and editing curriculum. Each table returns only your own rows. Anon sees no learner data. |
| G · sign out | A signed-in visit to `/login` redirects to `/track`. After sign-out, review and dashboard are gated and a lesson starts fresh and shows NOT SAVED. |
| H · phone width | No page scrolls sideways at 390 px. |

## Known and accepted

- **Answers are in the page source.** The lesson page sends the whole lesson to the browser: Decode text, the trap's verified output, hints and the reference solution. They are hidden from the DOM until each gate opens, but anyone reading the page source can find them. This was accepted for the hidden tests, and the same reasoning applies here. The review cards are different: they are graded on the server and never ship the answer.
- **Code isn't restored on reload.** Reloading resumes the lesson state (step, attempts, hints), but the rebuild and challenge editors go back to the starter code. Every submitted attempt's code is stored in `challenge_attempts`.
