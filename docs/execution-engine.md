# Execution engine (P0 spike result)

**Decision: run the real Go toolchain in the browser.** `cmd/compile` and `cmd/link` from the local Go install (go1.27.1) are built for `GOOS=js GOARCH=wasm`. They compile the learner's code to a WebAssembly program inside a Web Worker, and that program then runs in a fresh Go runtime instance. No server executes code.

The spec's first candidate, yaegi (an interpreter), was measured and **rejected**: it gets the curriculum's core traps wrong (details below).

Everything here was measured, not assumed. Raw evidence is in `docs/evidence/`:

| File | What it is |
|---|---|
| `yaegi-probe-log.txt`, `yaegi-probe-results.json` | yaegi vs real Go, 46 probes |
| `gc-wasm-probe-log.txt`, `gc-wasm-probe-results.json` | chosen engine vs real Go, 47 probes + 8 limit probes |
| `p0-browser.png` | headless Edge run of the P0 page |

Reproduce:

```
npm run engine:build     # builds public/engine/gen/ from the local toolchain
npm run engine:probe     # engine (Node worker, same JS as the browser) vs `go run`
npm run p0:verify        # real headless Edge against the P0 page, compared with `go run`
npm run p0:serve         # then open http://localhost:4173/p0/
```

---

## 1. Candidates evaluated

### A. yaegi compiled to wasm — rejected

yaegi v0.16.2-dev (master, 2026-02-09) built to 38.9 MB raw / 8.4 MB gzip. It matched real Go (stdout + exit code + first stderr line) on only **22 of 46** probes. The failures hit exactly what the lessons teach:

| Probe | Real Go | yaegi |
|---|---|---|
| `defer fmt.Println(x)` then `x = 2` (M6) | `deferred x = 1` | `deferred x = 2` |
| nil `*MyErr` returned as `error`, `err == nil` (M5) | `false` | `true` |
| `fmt.Errorf("%w", …)`, `errors.As` (M6) | wraps / true | `%!w(...)` / panic |
| type switch `case fmt.Stringer` (M5) | matches | falls to default |
| unexported struct field + `json.Marshal` (M11) | omitted | emitted as `"Xpassword"` |
| `declared and not used`, unused import | compile error | runs |
| `min`, `max`, `clear`, `slices.Sort`, range-over-func, `unsafe` | work | undefined / crash |
| generic `Map[T,U]` with a func argument; constraint with methods | works | type error |
| `os.Exit(3)` | exit 3, defers skipped | treated as panic, defers run |
| panic messages / exit code | `panic: …` + goroutine trace, exit 2 | `6:8: panic: main.main(...)`, exit 1 |

A teaching engine that gets the trap itself wrong can't be fixed with a disclosure note.

### B. TinyGo — not pursued

TinyGo's compiler depends on LLVM, and no maintained build of it runs in a browser. Even as a server-side compiler its runtime differs from `gc`: different scheduler, and different panic, reflection and map behavior. That would conflict with the "zero fabricated behavior" principle.

### C. The gc toolchain in wasm — chosen

The Go compiler and linker are pure Go, so they build for js/wasm without modification. Past browser-Go projects have used this idea. Here it is built directly from the local toolchain, so the compiler version, the stdlib and `wasm_exec.js` all come from the same Go install.

---

## 2. How it works

```
main thread                         Web Worker (public/engine/worker.js)
───────────                         ──────────────────────────────────────
WasmExecutor.run(files, opts) ──►   session.js
  timeout timer (run phase)           toolchain.js
  output cap                            in-memory FS (memfs.js) with /std/*.a archives
  worker.terminate() + respawn          compile.wasm  -lang=goX.Y -importcfg … -pack main.go
                                        link.wasm     -buildmode=exe -s -w
                             ◄──        run main.wasm in a fresh Go instance + fresh FS
  stdout/stderr streamed                  deadlock watchdog
```

- **Files** (`public/engine/`): `executor.js` (main thread, implements `GoExecutor`), `worker.js`, `session.js`, `toolchain.js`, `memfs.js`. Generated artifacts live in `gen/` (gitignored), built by `scripts/build-engine.mjs`.
- **Node uses identical code.** `scripts/engine-node.mjs` loads the same `session.js`/`toolchain.js`/`memfs.js` in a `worker_threads` Worker. Content verification (§8 of the spec) therefore tests exactly what the browser runs.
- **`wasm_exec.js`** is resolved at build time from `go env GOROOT`, trying `lib/wasm/` (≥ go1.24) and then `misc/wasm/` (older). No path is hardcoded.
- **Language version** per program: `-lang=go1.21` gives the pre-1.22 loop variable semantics, and the default is the toolchain's version. A lesson can show both behaviors, and both are verified (probe S1, browser check).
- **Compiler flags** per program, e.g. `gcflags: ["-m"]` for escape analysis. The output is byte-identical to native `go build -gcflags=-m` (probe S2).
- **Sandbox.** `syscall/js` ships because the runtime needs it, but user programs importing it get an explicit engine error, since it would expose the worker's JS globals such as `fetch`. Each run gets a fresh in-memory filesystem, so user code cannot touch the toolchain's files.

---

## 3. Measured results

### Language and runtime fidelity

On 47 probe programs, compared with `go run` using normalized output (source paths, PC offsets, argument hex values and goroutine ids rewritten; nothing else), stdout, exit code and full stderr match on **44 of 47**. The three mismatches are platform facts (probes 34 `runtime.GOOS/NumCPU`, 42 `NumGoroutine`, 47 racy counter), listed in §4. The limit probes S1–S8 are listed under "Hard limits".

| Area | Status | Evidence |
|---|---|---|
| Goroutines, unbuffered/buffered channels, `close`, `range` over channel | ✅ identical | probes 02, 36, 37 |
| `select` with `time.After`, `default` | ✅ identical | 03 |
| `sync.Mutex`, `RWMutex`, `Once`, `WaitGroup`, `atomic.Int64` | ✅ identical | 04, 45 |
| `context.WithTimeout` / `WithCancel` | ✅ identical | 05 |
| Generics: type params, `~` constraints, `comparable`, `cmp.Ordered`, generic types, constraint methods | ✅ identical | 06, 07, 43 |
| Go 1.21–1.23 features: `min`/`max`/`clear`, range-over-int, range-over-func, `slices`, `maps` iterators | ✅ identical | 18–20, 22 |
| Loop variable semantics by `go` directive (1.21 vs 1.22+) | ✅ identical | 17, S1 |
| Panics: index out of range, nil map write, nil deref, divide by zero, type assertion, custom, in goroutine, closed-channel send | ✅ identical message, trace and exit code 2 | 08–12, 29, 30, 36 |
| `fatal error: all goroutines are asleep - deadlock!` with goroutine dump | ✅ identical | 13, 44 |
| `os.Exit(3)`: exit 3, defers skipped | ✅ identical | 14 |
| Compile errors (unused var/import, mismatched types) | ✅ identical text, exit 1 | 15, 16, 41 |
| Escape analysis `-m` output | ✅ byte-identical | S2 |
| Interfaces: nil-pointer-in-interface ≠ nil, embedding, method sets | ✅ identical | 25, 26 |
| Errors: `%w`, `errors.Is/As`, `errors.Join`; `defer` argument timing, `recover` | ✅ identical | 23, 24 |
| `encoding/json` struct tags, `io`/`bufio` composition, `unsafe.Sizeof` | ✅ identical | 27, 35, 38 |
| `net/http` handlers via `httptest` | ✅ identical | 40 |
| Map iteration randomization | ✅ randomized | 33 |

### Stdlib: which packages import

The importable set is **177 packages**: all of `std` that builds for js/wasm, except `plugin`, `runtime/cgo` and `runtime/race`. `syscall/js` is blocked. `unsafe` is built into the compiler.

Packages are split into chunks, and a chunk is fetched only when a program imports one of its packages. The exact per-package map is in `public/engine/gen/manifest.json`.

| Chunk | Loaded | Contents | Size (raw / gzip) |
|---|---|---|---|
| `core` | at startup | fmt, errors, strings, strconv, bytes, bufio, io, os, sort, slices, maps, cmp, iter, sync, sync/atomic, context, time, math, math/rand(/v2), math/bits, unicode(/utf8,/utf16), reflect, regexp, encoding/json, /binary, /hex, /base64, container/heap, /list, crypto/sha256, hash/fnv, path(/filepath), log, runtime(/debug), testing, text/tabwriter, io/fs + deps (119 archives) | 36.6 / 8.5 MB |
| `net` | on import | net/http, net/http/httptest, net/url, net/netip, net/mail + deps (87) | 37.0 / 8.9 MB |
| `goast` | on import | go/ast, parser, scanner, token, printer, format, types, constant + deps (15) | 10.1 / 2.4 MB |
| `rest` | on import | everything else in std (148) | 53.8 / 13.2 MB |

Toolchain: `compile.wasm` is 50.1 MB raw / 10.0 MB gzip, and `link.wasm` is 11.7 / 3.1 MB.

**First-visit download: about 21.6 MB gzip** (compiler + linker + core). Filenames are content-hashed and served `immutable`, so repeat visits come from the HTTP cache.

### Timing (this machine: Intel i5, 16 GB, Windows 11)

| Measurement | Result |
|---|---|
| Browser cold start, empty cache, localhost (no network time) | 1877 ms |
| Browser cold start, warm HTTP cache | 327 ms |
| First run after load (JIT warming): compile + link + run | ~2.0 s |
| Typical warm run, `fmt` program | compile 100–250 ms, link 400–550 ms, run 40–70 ms, **≈0.6 s total** |
| Program importing `net/http` (larger link) | link ≈1.75 s |
| Compile error (stops before link) | ≈50 ms |
| Recovery after a timeout kill (worker respawn, warm cache) | 0.5–2.7 s |

On a real network, add the download time for 21.6 MB, roughly 3–4 s at 50 Mbps on the first visit only.

### stdout, stderr, exit codes

- fd 1 and fd 2 writes are captured at the `globalThis.fs` layer, so runtime-printed text (panics, fatal errors) is included. Output streams to the page as it is produced (`onStdout`/`onStderr`).
- `ExecResult` shape: `{status, exitCode, stdout, stderr, compileOutput, compileMs, linkMs, runMs, totalMs, engineError}`.
- `status` values:
  - `ok` (exit 0)
  - `exit` (non-zero; panics are exit 2, like native)
  - `deadlock` (exit 2)
  - `compile_error` (exit 1; diagnostics on `stderr` as `./main.go:L:C: …`, like `go run`)
  - `timeout`
  - `output_limit`
  - `engine_error`

### Hard limits

| Limit | Behavior | Evidence |
|---|---|---|
| Wall-clock timeout (run phase; per call, e.g. 5 s) | Worker terminated and respawned, `status: "timeout"`. A busy loop never yields, so only `terminate()` can stop it. | S3, browser check |
| Compile + link safety cap | 120 s | executor |
| Output cap | 1 MiB, then worker terminated, `status: "output_limit"` | S4 |
| Memory | wasm32 address space: real `fatal error: out of memory` at ≈4 GB in use | S5 |
| Recursion depth | 100 000 frames OK, 1 000 000 frames aborts on the JS host's wasm stack (see §4) | S6, S8 |
| Deadlock | Detected within ~30 ms of the program going idle | 13, 44 |

---

## 4. Divergences from native Go (must be disclosed in lessons that touch them)

1. **Single OS thread.** `runtime.GOOS/GOARCH` = `js/wasm`, and `runtime.NumCPU()` = `GOMAXPROCS` = 1. Goroutine scheduling is real (the Go runtime's scheduler), but nothing runs in parallel, so parallel speedups can't be shown.
2. **Data races are usually invisible.** 1000 goroutines doing unsynchronized `count++` gives the exact total in the engine, while natively it loses increments (probe 47). `-race` doesn't exist on js/wasm. **M8 race lessons run locally (option c).**
3. **`runtime.NumGoroutine()` is one higher after a timer has fired** (probe 42: native delta 0, engine delta 1). The extra goroutine is the runtime's JS event handler. Goroutine-leak lessons must measure deltas against a baseline taken after a timer has fired, or run locally.
4. **Stack traces use trimmed paths** (`main.go:9`, `sync/waitgroup.go:118`) instead of absolute paths, and PC offsets (`+0x7`) differ. Function names, line numbers and goroutine states match. Native-only lines such as `[signal 0xc0000005 …]` on nil dereference don't appear.
5. **Very deep recursion** (≈10⁶ frames) is aborted by the browser's WebAssembly call-stack limit before Go's 1 GB goroutine stack limit. The engine prints `[engine] program aborted by the JavaScript host: RangeError: Maximum call stack size exceeded …`, clearly labeled as not Go output, instead of `fatal error: stack overflow`.
6. **Memory tops out at ~4 GB** (wasm32).
7. **Deadlock dump.** The runtime also lists the goroutine used to trigger the check (`syscall/js.handleEvent`). The engine removes that one block, and everything else is the runtime's own text.
8. **Not available in the browser (option c, run locally):** `-race`, fuzzing, meaningful benchmark timings, listening sockets (`http.ListenAndServe`), `os/exec`, a persistent filesystem, `go vet`, `gofmt`, `go test` as a command. Challenge tests run through a generated harness in P2. `go/format` itself is importable, so a gofmt step can be added later.
9. **`go run` prints `# prog` before compile errors**; the engine does not.

## 5. `GoExecutor` contract

`public/engine/executor.js`, typed in TypeScript in P1:

```ts
interface GoExecutor {
  run(files: GoFile[], opts: { timeoutMs: number; lang?: string; gcflags?: string[];
       onStdout?(s: string): void; onStderr?(s: string): void }): Promise<ExecResult>
  capabilities(): EngineCapabilities
}
```

`capabilities().features` declares, for lesson gating:

- **true:** `goroutines`, `channels`, `select`, `sync`, `context`, `generics`, `deadlockDetection`, `escapeAnalysis`, `languageVersion`
- **false:** `parallelism`, `raceDetector`, `fuzzing`, `benchmarkTiming`, `netListen`

`capabilities().stdlib` lists the 177 importable packages. A lesson whose `requires` includes a false feature shows as locked, or as a run-locally lesson under option (c).

## 6. Risks carried forward

- **Asset size for deploy (P8).** `compile.wasm` (50 MB raw) and the `std-*.pack` files exceed some static-host per-file limits, e.g. Supabase Storage free tier (50 MB). Vercel limits need checking in P8. If needed: split packs further, or serve pre-compressed `.br` files.
- **Toolchain upgrades.** The engine is rebuilt from whatever `go` is on PATH. Content verification must run against the same build, and `manifest.json` records `goVersion`.
- **Chromium-verified only so far** (Edge headless). Firefox and Safari need checking before P8.
