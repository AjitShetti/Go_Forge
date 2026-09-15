# Content pipeline (P3)

Every Go output a learner sees in a lesson comes from actually running the program, never from someone typing what they think it prints. `scripts/verify-content.mjs` enforces that rule.

```
node scripts/verify-content.mjs                  # verify every lesson; exit 1 on any failure
node scripts/verify-content.mjs map nil          # only lessons whose slug contains "map" or "nil"
node scripts/verify-content.mjs --update         # rerun and rewrite expected.json (review the diff!)
npx vitest run tests/unit/content-pipeline.test.ts   # fast structural checks, no Go runs
```

A full run of the 16 M0–M3 lessons took 4 min 45 s on the dev machine (i5, 16 GB). Each program and challenge submission runs twice: once with `go` and once in the engine.

## Lesson layout

```
content/go/<module-slug>/<lesson-slug>/
  lesson.md                 JSON frontmatter + ## Provoke / Decode / Python/JS contrast / Rebuild / Challenge / Stretch
  trap.go                   the Provoke program (the lesson player shows it; don't embed it in lesson.md)
  rebuild.go                Rebuild starter
  rebuild/solution.go       proves the rebuild goal is reachable without touching locked lines
  challenge/starter.go      what the learner starts from
  challenge/solution.go     reference solution (shown only after a pass or "I give up")
  challenge/challenge_test.go   hidden table tests, package main
  challenge/wrong/*.go      at least one plausible wrong solution the tests must catch
  hints.json                ["hint 1", "hint 2"]
  expected.json             GENERATED — never edit by hand
```

The parser, the output comparison and the challenge harness are `src/lib/content/lesson.ts` and `src/lib/content/harness.ts`, the same modules the lesson player uses. The verifier and the app therefore can't disagree about what counts as a match.

## Code fences in lesson.md

Every `go` fence has to be one of these:

- `` ```go verified id=<id> `` — a complete program. The pipeline runs it and records its output under `blocks.<id>`. Options:
  - `mode=build` compiles without running and records compiler diagnostics (e.g. `gcflags=-m`).
  - `gcflags=-m,-l` passes compiler flags (comma-separated).
  - `lang=go1.21` sets the go.mod `go` directive.
  - `nondeterministic=sorted-lines` is for output whose line *order* varies (map iteration). The program runs 5 times and must print the same set of lines each time. `variedAcrossRuns` records whether the order actually changed in that run. It is informational and is not compared on later runs, because a small map can repeat its order by chance.
  - `mode=local reason=<why>` runs with real Go only, for things the browser can't do (option c). The lesson player labels it "run locally · real Go output recorded" and shows the command. `reason` is one word, such as `listens-on-a-port`.
  - `mode=local cmd=test args=-run=^$,-bench=.,-benchmem` runs the fence as `main_test.go` with `go test -count=1` plus those arguments (comma-separated). Without `args` it's `go test -v`.
  - `compare=shape` (only with `mode=local`) is for output whose numbers change between runs: benchmark iterations and ns/op, test durations, fuzz progress lines, the CPU name. Only those parts are replaced with `N`, and whitespace inside benchmark lines is collapsed. Everything else must match exactly, and the block runs twice to prove the shape is stable. Allocation counts (`B/op`, `allocs/op`) and fuzz failures are kept.
  - `diverges` is required when the engine's output differs from real Go. The lesson must then contain a paragraph starting `**Engine note:**`.
- `` ```go excerpt=<file> `` — a fragment quoted from a verified file. Every line must appear in that file verbatim.

A plain `` ``` `` fence (no language) is for pseudo-code and ASCII diagrams, and isn't run. A `` ```shell `` fence is a command for the learner to run on their machine; it isn't run, and the player labels it "run locally · output not shown".

## Lessons that need a native machine

A lesson's `requires` lists engine features. `src/lib/engine/features.ts` says which ones the browser engine has. When a lesson requires a feature it lacks (`raceDetector`, `fuzzing`, `benchmarkTiming`, `netListen`, `parallelism`), the track page shows a PARTLY RUN LOCALLY badge and the lesson shows a banner naming the feature and the local command. The trap, rebuild and challenge of such a lesson must still run in the browser: design them so the bug is visible without the missing feature (M8 data-races uses sleeps between check and act instead of the race detector).

Race-detector output is never shown. This machine has no C compiler for `-race`, and the owner decided (2026-09-15) not to add one, so `-race` appears only as a `shell` fence, and the capstone says plainly that race-freedom isn't verified.

## What fails a lesson

Frontmatter and text:
- `slug`, `title`, `concepts`, `requires` don't match `content/go/track.json`.
- A section is missing, or the body uses a markdown table or raw HTML (the lesson renderer supports neither).
- Any `.go` file isn't gofmt-clean. Files that deliberately don't parse, as in compile-error lessons, are exempt.
- `hints.json` isn't exactly two non-empty strings.

Programs:
- An unverified `go` fence, a duplicate block id, or a real-Go/engine divergence without a `diverges` marker and an Engine note (or a stale marker with no divergence).
- The trap answer isn't the verified output. For `choice`, `choices[answer]` must equal `observedOutput(real)`: stdout, plus the first stderr line when the program failed. Exactly one choice may match. `trap.go` must be deterministic.
- `rebuild/solution.go` changes a locked line, doesn't exit 0, or `rebuild.go` already prints the goal output.

Challenge (via `go test -v` and the in-browser `testing.Main` harness, which must agree case for case):
- The reference solution doesn't pass.
- The starter passes. A starter may fail to compile, if that's the lesson.
- A wrong solution passes, or fails without reaching the tests (a compile error proves nothing about the tests).

Finally, if everything above holds but the results differ from the committed `expected.json`, the lesson fails. That catches toolchain upgrades and edits to programs without a regenerate.

## expected.json

Written by `--update`. The lesson player reads it:

```
{
  goVersion,
  blocks: { <id>: { mode, compare, [lang], [gcflags], [variedAcrossRuns], real: {stdout, stderr, exitCode}, engine: {…, status}, diverges } },
  challenge: { tests: [leaf case names], solution: {passed, cases}, starter: {passed, cases}, wrong: { <file>: {passed, cases} } },
  rebuild: { expectedStdout, lockedLines }
}
```

Outputs are normalized only where platforms legitimately differ: temp paths, `.\file.go` versus `./file.go`, PC offsets, goroutine ids, argument values in stack frames, and the `# prog` build header (`scripts/real-go.mjs` `normalizeOutput`, plus `norm` in the verifier).

## Engine divergences in M0–M3

None. All 16 lessons (77 programs plus 64 challenge submissions covering 114 test cases) give identical results in real Go and in the browser engine. The things that do diverge, which are listed in `docs/execution-engine.md` §4, first matter in M7–M8 (parallelism, `-race`, `NumGoroutine`).

## Authoring notes that came from real failures

- **Locked lines are compared by line number.** A rebuild solution that inserts a line above a locked line fails, so put code that needs to grow *below* the locked lines, or lock only the data line.
- **Nondeterministic traps don't work:** the learner predicts exact text. Make the trap print a deterministic *fact* about the randomness instead (the map-order lesson prints whether 50 loops all agreed).
- **Don't show `-m` diagnostics as the trap** when the answer is "one line of the output". Measure the effect instead (`testing.AllocsPerRun`), and put the `-m` output in a `mode=build` fence in Decode.
- **Challenge results must be deterministic too.** A starter that fails *randomly* (one that depends on map order, for example) makes `expected.json` flap. The map-order starter sorts alphabetically, so it fails the same way every run.
