---
{
  "slug": "data-races",
  "title": "Races and -race",
  "concepts": ["data-races"],
  "requires": ["raceDetector"],
  "trap": {
    "concept": "data-races",
    "question": "Three seats, five buyers at once. Each checks seats > 0, spends 10ms charging a card, then takes a seat. The booked counter is atomic. What's printed?",
    "kind": "choice",
    "choices": [
      "booked: 3 of 3 seats",
      "booked: 5 of 3 seats",
      "booked: 1 of 3 seats",
      "fatal error: concurrent map writes"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `approved: 2 declined: 3`. main (lines 10–25) is locked.",
    "lockedLines": [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  },
  "challenge": {
    "prompt": "Make `Profiles` safe: concurrent `AddTag` calls never add the same tag twice, and `Tags` never lets a caller reach the stored slice.",
    "entry": "starter.go"
  }
}
---

## Provoke

The flash sale in miniature. `seats` is a plain `int`. Five goroutines each check `seats > 0`, spend 10ms "charging a card", then decrement. Only the `booked` counter is atomic, so the number printed is exact.

## Decode

### What a data race is, precisely

A **data race** is two goroutines accessing the **same memory**, at least one of them **writing**, with **no synchronization** ordering the accesses. The Go memory model says a program with a data race has no defined behavior for those accesses. That's stronger than "the count might be off":

- A read can see a **half-written** value. A `string`, slice or interface is several machine words, and a reader can get the new pointer with the old length. That's a crash or memory corruption, not just a wrong number.
- The compiler assumes there are no races. It can keep a value in a register, reorder writes, or skip re-reading a variable, so racy code can behave in ways no interleaving of the source lines explains.

`seats` in the trap is raced on: five goroutines read and write it with no lock.

### A race-free program can still be wrong

The trap's wrong answer doesn't come from the data race. All five buyers **checked** before any of them **acted**, because each check was separated from its update by a slow call. That's a **race condition**, a logic bug about order, sometimes called check-then-act. Wrap every access to `seats` in a mutex and the data race is gone, but it still books 5. The Rebuild is exactly that: every access is locked, the race detector would find nothing, and the account still overdraws.

Keep the two apart:

- **Data race**: unsynchronized memory access. Tools can detect it.
- **Race condition**: a correct-looking sequence of synchronized steps that isn't **atomic** as a whole. Only design fixes it: one critical section around the whole decision, a compare-and-swap, or a database constraint.

The Challenge has both kinds. One is in time: a check and a write in separate critical sections. The other is in space: `Tags` returns a slice whose backing array (M3) is still the one stored in the map, so the caller reads and writes it after the lock is released. **A mutex protects code paths, not memory**, and data that escapes the critical section isn't protected at all.

### The race detector

`-race` compiles your program with **ThreadSanitizer** instrumentation. Every memory read and write records which goroutine touched which address, together with a logical clock of the synchronization events (locks, channel operations, `WaitGroup` waits) that goroutine has seen. When two accesses to the same address happen with no synchronization event ordering them, and one is a write, it prints `WARNING: DATA RACE` with both stacks.

```shell
go test -race ./...
go run -race .
```

What it can and can't do:

- It finds races that **actually happen during that run**. A race on a code path your tests don't exercise stays invisible, so run it on real concurrent tests, and in CI.
- It has **no false positives**: every report is a real data race.
- It costs roughly 5–10× memory and 2–20× CPU, so it's for tests and staging, not production.
- It can't see race *conditions*. The Rebuild's program is clean under `-race`.

**Engine note:** the browser engine has no race detector, and it runs every goroutine on one thread, so a racy `count++` from many goroutines gives the exact total there while native Go loses increments. That's why this lesson's programs make the bug **visible in the output** with sleeps between check and act, instead of relying on lost updates. Run the commands above on your machine for the detector. Its output isn't shown here, because this lesson's content couldn't be verified with `-race`.

## Python/JS contrast

- **Python**: the GIL makes single bytecodes atomic, so `count += 1` from threads *usually* works, and people conclude there are no races. It's several bytecodes, and it can still lose updates. Check-then-act across `time.sleep` or I/O breaks exactly like the trap. There's no built-in race detector.
- **JavaScript**: one thread means no data races at all in plain JS. But the trap happens verbatim across an `await`: read the stock, `await chargeCard()`, write the stock. Race conditions don't need threads.
- **False friend:** "`-race` passed, so it's thread-safe". It proves no data race happened in that run. It says nothing about atomicity.

## Rebuild

`Withdraw` locks when it reads the balance and locks again when it writes, with a slow payment call in between. Every access is synchronized, and five withdrawals of 40 still all succeed against a balance of 100. `main` is locked.

## Challenge

`Profiles` is shared by many goroutines. The hidden tests run 20 goroutines adding the same tag while `OnRead` sleeps between reading and writing, then change and append to slices returned by `Tags` and check the stored tags didn't move.

## Stretch

Locally, run the trap with `go run -race .` and read both stacks in the report. Then fix it with one mutex around check-and-decrement and run `-race` again. Finally, remove the sleep, keep the separate locks from the Rebuild, and run it 1,000 times in a loop: how often does it oversell without the sleep, and what does that say about testing for race conditions by just running the code?
