# Build Prompt — "Go Forge": a first-principles Go learning platform + system design canvas

> Paste this whole file into Claude Code at the root of an empty repo.

---

## 0. Role and goal

You are building a single web app with two halves:

1. **Go Track** — teaches Go from zero to advanced through a *build → fail → decode → pass* loop. Go code compiles and runs **in the browser** (no code-execution server).
2. **Design Canvas** — a drag-and-drop system design canvas where I lay out components, wire them, and get graded against scenario constraints.

One user (me, for now), but built as a real product: real auth, real Postgres, real persistence of every attempt.

Before you write code, read this entire document, then give me: (a) your understanding in 10 lines, (b) anything here you think is technically wrong or risky, (c) the questions you need answered. **Do not start scaffolding until I reply.**

---

## 1. Non-negotiable principles

These override any default habit you have.

1. **No memorization-first content.** Never open a topic with a definition list or syntax table. Every topic opens with a runnable program that behaves in a way the learner will get wrong.
2. **Prediction gate.** The learner must type/select what they think the output is *before* the Run button unlocks. The explanation stays hidden until after they've seen their prediction vs. reality. Enforce this in the UI state machine, not with an honor-system prompt.
3. **Decode means mechanism.** Explanations answer *why the language behaves this way* — memory layout, what the compiler does, what the runtime does — not "this is the syntax."
4. **Contrast with Python/JS.** I come from Python (primary) and JavaScript. Where Go differs, say what the Python/JS equivalent does and why Go chose otherwise. Where it's a false friend, say so loudly.
5. **Every topic ends in a challenge that can fail.** Hidden test cases, real pass/fail, no participation trophies. A topic is not "done" until tests are green.
6. **Zero fabricated Go behavior.** Every "expected output" in lesson content must be produced by actually executing the snippet with a real Go toolchain (see §8). If you cannot verify an output, the lesson does not ship.
7. **Honest state.** Never stub a feature and present it as working. If something is a placeholder, it renders a visible "NOT IMPLEMENTED" badge.
8. **Small commits, verified.** Each phase ends with: it builds, it runs, tests pass, and you tell me exactly what you verified and how.

---

## 2. Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase: Postgres + Auth (email magic link) + Row Level Security
- Monaco editor for the Go editor
- `@xyflow/react` (React Flow) for the canvas
- Go → WebAssembly for in-browser execution (see §3)
- Vitest + Playwright for tests
- Local dev target: CPU-only Intel i5, 16 GB RAM. Keep the dev server and build light; no heavy watchers, no Electron, no Docker requirement for the app itself.

---

## 3. Phase 0 — the risky part, do this FIRST

**The hard problem:** the browser can run Go compiled to WASM, but it cannot run the Go *compiler* out of the box. Arbitrary user-written Go therefore needs an execution engine that itself runs in WASM.

Spike this before anything else. Timebox it, and report back with findings rather than silently picking one.

Evaluate, in this order:

- **A. `yaegi` (Go interpreter) compiled to `GOOS=js GOARCH=wasm`.** Most promising: user code is interpreted inside the browser.
- **B. TinyGo-based approach.**
- **C. Any maintained "Go playground in the browser" WASM project you can find.**

For whichever you pick, **empirically determine and document** in `docs/execution-engine.md`:

- Which stdlib packages are importable
- Goroutines, channels, `select`, `sync`, `context`: supported or not, and how faithfully
- Generics support
- `panic` / runtime error messages: do they match real Go?
- Bundle size and cold-start time
- How stdout, stderr, and exit codes are surfaced
- Hard limits (timeouts, infinite loops, memory)

Notes on locating WASM glue: `wasm_exec.js` lives under `$(go env GOROOT)` but its path moved between Go versions (`misc/wasm/` in older, `lib/wasm/` in newer). Resolve it at build time with `go env GOROOT`; never hardcode the path.

**Architectural requirement:** put everything behind an interface:

```ts
interface GoExecutor {
  run(files: GoFile[], opts: { timeoutMs: number }): Promise<ExecResult>
  capabilities(): EngineCapabilities  // stdlib list, goroutines?, generics?
}
```

with `WasmExecutor` as the implementation. If the spike shows WASM can't cover the concurrency topics faithfully, we swap in a server-side runner later **without touching lesson content or UI**. Lessons declare `requires: ["goroutines", "generics"]` and are gated on `capabilities()` — a lesson the engine can't run must be visibly locked, never silently broken.

**Phase 0 exit criteria:** a plain page where I paste a Go program using goroutines, a `WaitGroup`, and a channel, hit Run, and see correct output and correct panic messages — entirely client-side.

---

## 4. The learning loop (the core of the product)

Each **lesson** is a strict state machine. Model it explicitly (`lessonMachine.ts`), persist every transition.

| Step | Name | What the learner sees | Persisted |
|---|---|---|---|
| 1 | **Provoke** | A short runnable program with a trap. Question: "What does this print?" Free-text or multiple-choice. Run button disabled. | prediction text, timestamp |
| 2 | **Collide** | Actual output appears side by side with their prediction. Match / mismatch is stated plainly. No explanation yet. | correct bool, actual output |
| 3 | **Decode** | The mechanism. Diagram where it helps (slice headers, goroutine scheduling, interface = type+value pair). Python/JS contrast block. | time spent, expanded sections |
| 4 | **Rebuild** | Editable version of the trap program + a stated goal ("make this print X without changing line 7"). Free experimentation, unlimited runs. | each run: code snapshot, output |
| 5 | **Challenge** | A real task with hidden table-driven tests. Must pass to advance. Tests run in the same WASM engine. | attempts, diffs, pass/fail, duration |
| 6 | **Stretch** | Open-ended: "break it" / "make it 10x faster" / "make the race detector angry." Optional, no grading, saved to my notebook. | submission |

Additional rules:

- **Hints cost something visible.** Hint 1 after 2 failed attempts, hint 2 after 4, full solution only after a correct attempt or explicit "I give up" (which marks the topic for review, not complete).
- **Mistake ledger.** Every wrong prediction is stored with its concept tag. A `/review` page resurfaces the concepts I got wrong, weighted by recency and error count. Simple SM-2-style scheduling is fine; don't over-engineer.
- **Mastery is earned per concept, not per page visited.** A concept is `mastered` only when: prediction correct on first try in a later lesson touching the same tag, AND its challenge passed without full-solution reveal.

---

## 5. Go curriculum (first principles, in this order)

Structure: **Track → Module → Lesson**. Each lesson gets a trap. Suggested traps below — verify each one actually behaves this way on the pinned Go version before shipping it; fix the content if it doesn't.

**M0 — What "compiled" actually means**
`go run` vs `go build` (and why timing `go run` is not a benchmark), source → tokens → AST → type check → SSA → machine code, the runtime embedded in every binary, static linking and binary size. Contrast: CPython bytecode + eval loop, V8 JIT.

**M1 — Types, values, memory**
Zero values, no implicit conversion, `int` vs `int64` sizing, integer division, `byte` vs `rune` vs `string` (indexing a string gives a byte; `len` is bytes, not characters).

**M2 — Pointers, stack, heap**
Values copy by default, pointer receivers, escape analysis (`go build -gcflags=-m`), why Go has pointers but no pointer arithmetic.

**M3 — Slices and maps, internals first**
Slice header (ptr/len/cap), `append` reallocation vs aliasing, slicing shares the backing array, why `range` gives you a *copy*, nil map read is fine but write panics, randomized map iteration order.

**M4 — Structs, methods, composition**
Value vs pointer receivers and the method set rules, embedding instead of inheritance.

**M5 — Interfaces**
Interface = (type, value) pair; the classic `nil` interface holding a nil pointer is not `nil`; implicit satisfaction; small interfaces; `io.Reader`/`io.Writer` composition.

**M6 — Errors as values**
Sentinel vs typed errors, wrapping with `%w`, `errors.Is` / `errors.As`, when `panic` is actually correct, `defer` argument evaluation timing, `recover` boundaries.

**M7 — Concurrency I**
Goroutines, the GMP scheduler model, `WaitGroup`, unbuffered vs buffered channels, deadlock messages, `select`, closing channels, why "share memory by communicating."
*Accuracy note:* the classic loop-variable capture bug changed in Go 1.22 (per-iteration scoping). Teach both: what old code does, what the current version does, and how `go.mod`'s `go` directive decides. Don't ship a stale trap.

**M8 — Concurrency II**
Data races and `-race`, `sync.Mutex`/`RWMutex`/`Once`/atomics, `context` cancellation and timeouts, worker pools, fan-in/fan-out, goroutine leaks.

**M9 — Generics**
Type parameters, constraints, `any`/`comparable`, when generics are the wrong tool.

**M10 — Testing and tooling**
Table-driven tests, subtests, benchmarks, fuzzing, `go vet`, `gofmt` as non-negotiable, modules and versioning.

**M11 — Standard library in anger**
`net/http` server internals and handler/mux model, `encoding/json` and struct tags, `io` composition, `time`.

**M12 — Capstone**
A concurrent, testable program: e.g. an in-memory key-value store with TTL and an HTTP API, plus a bounded worker pool and graceful shutdown via `context`. Graded on: correctness tests, race-free under `-race`, graceful shutdown, and a written explanation of one design tradeoff.

---

## 6. Design Canvas

**Canvas:** React Flow. Palette → drag onto canvas → connect → configure → validate.

**Node types** (each with an icon, config panel, and defaults): Client / Mobile, CDN, Load Balancer, API Gateway, App Service, Worker, Message Queue, Cache, SQL DB (with primary/replica toggle), NoSQL store, Object Store, Search Index, Rate Limiter, Pub/Sub topic, Cron.

**Edge types** (visually distinct): sync request, async event, replication, cache read-through, batch/ETL.

**Node config** (drives the grader): replicas, region, QPS in/out, p99 latency, storage size, consistency model, persistence on/off.

**Scenario mode.** Each scenario states: functional requirements, scale numbers, and 3–5 hard constraints. The learner designs; then **Grade** runs a deterministic rule engine, not vibes. Rules like:

- Single stateful node with no replica on a path marked "must survive node loss" → **SPOF violation**
- Read-heavy path (read:write ratio in scenario) with no cache → **flagged**
- Queue with no dead-letter path → **flagged**
- Client → DB with no service in between → **flagged**
- Sum of component capacity below scenario peak QPS → **capacity violation**, with the arithmetic shown

Output a scored report: violations, warnings, and "tradeoffs you didn't declare." Every rule must cite the number that triggered it — no unexplained scores.

**Seed scenarios** (6–8), including an **event-ticketing flash sale** (sudden spike, no overselling, fair queueing) — I'm already working through a ticketing-style system design roadmap, so that one should be first. Others: URL shortener, news feed fanout, rate-limited public API, file storage with CDN, chat with presence.

**Persistence:** designs saved per user with version history and a diff view between versions. Export/import as JSON. Optional LLM critique is a *separate* button that clearly labels its output as opinion — the deterministic grader is the source of truth.

---

## 7. Data model (Supabase, RLS on every table)

```
profiles(id, email, created_at)
tracks(id, slug, title, order)
modules(id, track_id, slug, title, order)
lessons(id, module_id, slug, title, order, requires[], content_ref)
concepts(id, slug, title)                        -- tags for mastery
lesson_concepts(lesson_id, concept_id)
predictions(id, user_id, lesson_id, text, correct, created_at)
runs(id, user_id, lesson_id, code, stdout, stderr, exit_code, ms, created_at)
challenge_attempts(id, user_id, lesson_id, code, passed, failed_cases jsonb, hints_used, created_at)
mastery(user_id, concept_id, state, streak, last_seen, next_review)
notebook(id, user_id, lesson_id, body, created_at) -- stretch answers + my own notes
designs(id, user_id, scenario_id, graph jsonb, version, created_at)
design_reviews(id, design_id, score, violations jsonb, created_at)
scenarios(id, slug, title, requirements jsonb, constraints jsonb, rules jsonb)
```

RLS: a user reads/writes only their own rows; content tables are read-only to clients.

---

## 8. Content pipeline (this is how we avoid fabricated content)

Lessons live as MDX + frontmatter in `content/go/`, not in the database body. A build script `scripts/verify-content.ts`:

1. Extracts every code block tagged `go:verified` from lesson content
2. Runs it with the **local Go toolchain** (pinned version, recorded in the repo)
3. Writes the real stdout/stderr into a generated `expected.json`
4. **Fails the build** if any block's committed expected output differs from actual
5. Separately runs each block through the WASM engine and flags divergence between real Go and the browser engine — divergences must be disclosed in the lesson, not hidden

Challenge tests are Go table tests stored beside the lesson; the same script asserts that the reference solution passes and that at least one obvious wrong solution fails.

---

## 9. Milestones

Stop at the end of each and report. Don't run ahead.

- **P0** — Execution engine spike + `docs/execution-engine.md` + the goroutine proof page. *(No UI polish. This is go/no-go.)*
- **P1** — Repo, Next.js, Tailwind, Supabase auth + schema + RLS, empty shell with nav.
- **P2** — Lesson state machine with one fully hand-built lesson (M3: slice aliasing) end to end: prediction gate → collide → decode → rebuild → challenge with hidden tests.
- **P3** — Content pipeline + M0–M3 authored and verified.
- **P4** — Mistake ledger, review scheduling, mastery tracking, progress dashboard.
- **P5** — Canvas: nodes, edges, config panels, save/load.
- **P6** — Rule engine + grading report + the ticketing flash-sale scenario.
- **P7** — Remaining modules M4–M12, remaining scenarios, capstone.
- **P8** — Polish, Playwright flows, deploy to Vercel.

---

## 10. How I want you to work

- Ask before assuming. If a requirement here is ambiguous, ask — don't pick and hope.
- Push back on anything above that's a bad idea. I'd rather change the spec than build the wrong thing.
- Keep the tone of lesson content plain and direct — a smart friend explaining, not a textbook, not corporate.
- Never claim something works without having run it. Show me the command and the output.
- Keep dependencies minimal; every new package needs a one-line justification.
