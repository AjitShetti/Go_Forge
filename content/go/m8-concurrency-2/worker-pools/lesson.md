---
{
  "slug": "worker-pools",
  "title": "Worker pools, fan-in, fan-out",
  "concepts": ["worker-pools"],
  "requires": ["goroutines"],
  "trap": {
    "concept": "worker-pools",
    "question": "Two workers square jobs. main sends all five jobs, closes the jobs channel, then reads five results. Both channels are unbuffered. What happens? (The runtime's first stderr line counts as output.)",
    "kind": "choice",
    "choices": [
      "1\n4\n9\n16\n25",
      "4\n1\n9\n16\n25",
      "fatal error: all goroutines are asleep - deadlock!",
      "1\n4\nfatal error: all goroutines are asleep - deadlock!"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it print `30`. main (lines 8–10) is locked.",
    "lockedLines": [8, 9, 10]
  },
  "challenge": {
    "prompt": "Write `ProcessAll(items, limit, work)`: run work on every item with at most `limit` calls at once, actually use that parallelism, and return results in input order.",
    "entry": "starter.go"
  }
}
---

## Provoke

The textbook worker pool: a `jobs` channel, a `results` channel, two workers ranging over `jobs`. `main` sends every job, closes `jobs`, and then collects the results.

## Decode

### Every blocked send is waiting for someone specific

Walk it step by step. Unbuffered channels mean every send needs a matching receive at the same moment:

1. Worker A receives job 1, squares it, and blocks on `results <- 1`. Nobody is reading `results` yet.
2. Worker B receives job 2 and blocks on `results <- 4`.
3. `main` tries `jobs <- 3`. Both workers are stuck sending, so nobody is receiving `jobs`.

A waits for `main` to read results. `main` waits for a worker to take a job. It's a cycle, so nothing moves. The runtime sees every goroutine parked and stops the program.

This is the central fact about pipelines: **a stage that produces faster than the next stage consumes blocks**, and that backpressure travels backwards to whoever is feeding it. That's usually what you want, because it stops a fast producer from filling memory. But the feeding side and the draining side have to run **at the same time**, or the pipeline locks up the moment it fills.

### The shape that works

- **Fan-out**: several workers range over one `jobs` channel. Each job goes to exactly one worker.
- **Feed from a goroutine** (or before the workers could fill anything), so feeding and collecting overlap.
- **Fan-in**: all workers send to one `results` channel.
- **Close `results` exactly once, after every worker is done**: `go func() { wg.Wait(); close(results) }()`. The collector can then `range` over `results` and stop naturally. Calling `wg.Wait()` *before* reading is the Rebuild's deadlock again: the workers can't finish while their sends are blocked.

### Why limit concurrency at all

`go f()` is cheap, so why not one goroutine per item? Because the **resource** usually isn't. There are only so many database connections, API rate-limit slots, file descriptors and gigabytes of RAM for images being resized. The number of workers is the concurrency limit, and it doesn't depend on how many items you have.

A **semaphore** is the other common shape: a buffered channel `sem := make(chan struct{}, limit)`, with `sem <- struct{}{}` before starting each piece of work and `<-sem` after. It's one goroutine per item, but only `limit` of them past the gate at a time.

Order is a separate concern. Results come back in completion order. If the caller needs input order, carry the index with the job and write `out[i]`.

## Python/JS contrast

- **Python**: `concurrent.futures.ThreadPoolExecutor(max_workers=4).map(f, items)` is this whole lesson in one call, and `map` returns results in input order. `executor.submit` plus `as_completed` gives completion order. Go makes you choose the shape explicitly.
- **JavaScript**: `Promise.all(items.map(f))` starts every call at once, which is unbounded concurrency. Libraries like `p-limit` add the semaphore. `Promise.all` keeps input order.
- **False friend:** a pool that reads results after sending all jobs *looks* like Python's `map`. `map` feeds and collects concurrently for you; here you have to arrange that yourself.

## Rebuild

`sumSquares` waits for its workers before reading their results. `main` is locked.

## Challenge

`ProcessAll` runs slow work with a concurrency limit. The hidden tests measure the most calls ever running at once, give earlier items longer delays so they finish last, and time 12 items of 50ms with a limit of 4 (about 150ms if the limit is used, 600ms if not).

## Stretch

Rewrite `ProcessAll` with a semaphore channel instead of a fixed pool. Then add error handling: stop starting new work after the first error, and return it. Which version makes "stop starting new work" easier, and why does `errgroup.SetLimit` choose the semaphore shape?
