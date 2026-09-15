---
{
  "slug": "goroutine-leaks",
  "title": "Goroutines that never end",
  "concepts": ["goroutine-leaks"],
  "requires": ["goroutines"],
  "trap": {
    "concept": "goroutine-leaks",
    "question": "search gives up on a 50ms backend after 10ms. It's called three times, then main waits 100ms, long enough for every backend call to finish, and counts goroutines. What's printed?",
    "kind": "choice",
    "choices": [
      "timeout\ntimeout\ntimeout\nstill running: 0",
      "timeout\ntimeout\ntimeout\nstill running: 3",
      "result for go\nresult for go\nresult for go\nstill running: 0",
      "timeout\ntimeout\ntimeout\nstill running: 1"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Keep the three first lines and make it print `still running: 0`. main (lines 9–17) is locked.",
    "lockedLines": [9, 10, 11, 12, 13, 14, 15, 16, 17]
  },
  "challenge": {
    "prompt": "Make `Numbers(ctx)` stop and close its channel promptly after ctx is cancelled, even when nobody is reading.",
    "entry": "starter.go"
  }
}
---

## Provoke

`search` starts a goroutine for a slow backend call (50ms) and waits for it with a 10ms timeout. `main` calls it three times, then sleeps 100ms, so every backend call has certainly finished, and counts the goroutines still alive.

## Decode

### Finishing the work isn't the same as returning

After 50ms, each backend goroutine wakes up with its result and executes `ch <- "result for go"`. `ch` is unbuffered, so the send needs a receiver. The only receiver was `search`, and `search` returned 40ms ago through the timeout case. Nothing will ever read `ch` again, so the send never completes. The goroutine is parked forever.

That's a **goroutine leak**: a goroutine blocked on an operation that can never proceed. It isn't a deadlock, because other goroutines (`main`) are still running, so the runtime reports nothing. Each leaked goroutine holds its stack, plus everything it references: the channel, the query string, whatever response it was holding. In a server, one leak per timed-out request climbs slowly until the process runs out of memory.

The garbage collector can't help. A goroutine is a GC **root**, and nothing it can reach is garbage while it exists, even if no other code could ever wake it.

### Every goroutine needs a way to end

Before writing `go`, answer: **what makes this goroutine return?** And make sure that thing can happen on every path, including timeouts, errors and early returns in the caller. The common fixes:

- **A buffer where exactly one value may go unread.** `make(chan string, 1)` lets the late sender complete its send and exit. The value sits in the buffer, and the channel is garbage collected along with it.
- **A way to tell the producer to stop.** A `done` channel, or a `ctx`, that the producer selects on *in the same `select` as its blocking send*. A check before the send doesn't help once the send is already blocked.
- **The producer closes its output** when it stops, so readers that `range` over it finish too.

`runtime.NumGoroutine()` makes leaks visible in tests. Take a count before, run the code, give things a moment to wind down, and compare. Libraries such as `go.uber.org/goleak` automate that check.

**Engine note:** in the browser engine, `runtime.NumGoroutine()` reads one higher than native Go after the first timer has fired, because of the goroutine that handles JavaScript events. This lesson's programs and tests take their baseline after a timer has fired, so the differences they print are the same as native Go.

## Python/JS contrast

- **Python**: a thread blocked forever on `queue.get()` is the same leak. It even keeps the interpreter alive at exit unless it's a daemon. An `asyncio` task awaiting a future that nobody resolves is also a leak, but `asyncio` warns about pending tasks when the loop closes.
- **JavaScript**: a promise that never settles doesn't hold a thread or a stack, only its closure, so leaks are cheaper there and even harder to notice.
- **False friend:** "the timeout fired, so the slow call was cancelled". The timeout only stopped *waiting*. The work, and the goroutine doing it, carries on until something tells it otherwise.

## Rebuild

`firstLine` reads one line from a generator that has 1,000 to send, and walks away. Each call leaves a goroutine blocked on its second send. `main` is locked.

## Challenge

`Numbers(ctx)` produces an infinite stream. The hidden tests read a few values and cancel. Then they check that the channel gets closed, that the producer exits even if the reader stops reading *before* cancelling, and that an already-cancelled context doesn't start a goroutine that lingers.

## Stretch

Run a small HTTP server locally with a handler that starts `search` from the trap, and hammer it with `hey` or `ab`. Watch `runtime.NumGoroutine()` through `/debug/pprof/goroutine?debug=1` (import `net/http/pprof`). How does the goroutine profile point straight at the leaking line?
