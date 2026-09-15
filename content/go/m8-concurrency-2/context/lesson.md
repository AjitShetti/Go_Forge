---
{
  "slug": "context",
  "title": "context cancellation and timeouts",
  "concepts": ["context"],
  "requires": ["goroutines"],
  "trap": {
    "concept": "context",
    "question": "A worker prints a line every 50ms, three times. At 75ms, main cancels the context and prints ctx.Err(), then waits for the worker. What's printed?",
    "kind": "choice",
    "choices": [
      "working 0\ncancelled: context canceled",
      "working 0\ncancelled: context canceled\nworking 1\nworking 2",
      "working 0\ncancelled: <nil>\nworking 1\nworking 2",
      "cancelled: context canceled\nworking 0\nworking 1\nworking 2"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `2 context deadline exceeded`. main (lines 9–14) is locked.",
    "lockedLines": [9, 10, 11, 12, 13, 14]
  },
  "challenge": {
    "prompt": "Write `FetchAll`: fetch every url concurrently, return bodies in order, cancel the remaining fetches on the first error, honor the caller's timeout, and never return while a fetch is still running.",
    "entry": "starter.go"
  }
}
---

## Provoke

`main` makes a cancellable context and starts a worker that prints three lines, 50ms apart. After 75ms, `main` calls `cancel()`, prints `ctx.Err()`, and waits for the worker to finish.

## Decode

### Cancellation is a message, not a kill switch

Go has **no way to stop a goroutine from the outside**. No `thread.kill`, no interrupt, no exception injected into it. A goroutine ends when its function returns, and nothing else ends it.

A `context.Context` is how you *ask*. `cancel()` does exactly two things: it closes the channel returned by `ctx.Done()`, and it makes `ctx.Err()` return `context.Canceled` from then on. Code that selects on `ctx.Done()` or checks `ctx.Err()` sees the request and can decide to return. Code that never looks, like the trap's worker, keeps going.

So at 75ms the context really was cancelled (`ctx.Err()` says so), and the worker printed `working 1` and `working 2` anyway. It was sleeping with `time.Sleep`, which can't be interrupted, and it never checked.

### Contexts form a tree

Every context except `context.Background()` has a parent:

- `context.WithCancel(parent)` returns a child plus the `cancel` function that cancels it.
- `context.WithTimeout(parent, d)` and `WithDeadline` cancel the child automatically when time runs out, and its error is then `context.DeadlineExceeded`.
- `context.WithValue(parent, key, v)` carries request-scoped data, such as a request ID or auth info.

**Cancelling a parent cancels every descendant.** Cancelling a child never affects its parent. An HTTP server gives each request a context that's cancelled when the client disconnects. Your handler derives children for its database calls and outbound requests, and one disconnect cancels the whole tree:

```go verified id=tree
package main

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type key string

func main() {
	root := context.Background()
	parent, cancelParent := context.WithCancel(root)
	child, cancelChild := context.WithTimeout(parent, time.Hour)
	defer cancelChild()
	reqCtx := context.WithValue(child, key("request-id"), "r-42")

	cancelParent()
	<-reqCtx.Done()
	fmt.Println(reqCtx.Err(), reqCtx.Value(key("request-id")))
	fmt.Println(errors.Is(reqCtx.Err(), context.Canceled))

	short, cancelShort := context.WithTimeout(root, 10*time.Millisecond)
	defer cancelShort()
	<-short.Done()
	fmt.Println(short.Err(), errors.Is(short.Err(), context.DeadlineExceeded))
}
```

The child had an hour left, but its parent was cancelled, so it's done too, with the parent's reason.

### The conventions

- `ctx context.Context` is the **first parameter**, named `ctx`. It's never stored in a struct.
- **Always call `cancel`**, usually with `defer`, even if the work finished. Until the context is cancelled or its parent is, it keeps a timer and stays registered with the parent. `go vet` warns about a `cancel` that isn't used.
- Blocking code waits on work **and** `ctx.Done()` in one `select`. `time.Sleep` becomes `select { case <-time.After(d): case <-ctx.Done(): return ctx.Err() }`.
- Cancelling doesn't wait. If you must not return while workers are still running, **cancel, then wait** (a `WaitGroup`).
- `WithValue` is for request-scoped data crossing API boundaries, not a way to pass optional arguments.

## Python/JS contrast

- **Python**: `asyncio` cancellation *does* reach into a task: `task.cancel()` raises `CancelledError` at the next `await`. Go has no equivalent; the goroutine has to check. Threads in Python can't be cancelled at all, so people pass a `threading.Event`, which is a hand-rolled `ctx.Done()`.
- **JavaScript**: `AbortController` / `AbortSignal` is the same design as Go's context. `fetch` accepts a signal and checks it, and your own loops must check `signal.aborted` themselves.
- **False friend:** `cancel()` sounds like it stops the work. It only sends the request, and the work has to listen.

## Rebuild

`countSlowly` receives a context with a 120ms timeout and ignores it, sleeping through all five steps. `main` is locked.

## Challenge

`FetchAll` is a small `errgroup`. The hidden tests give it a fake web whose fetches honor the context and take 20ms to clean up after being cancelled. They check order and concurrency, that one failure cancels exactly the slow fetches, that nothing is still running when `FetchAll` returns, and that a 50ms caller timeout comes back as `context.DeadlineExceeded`.

## Stretch

Replace your `sync.Once` and `cancel` with `context.WithCancelCause`, and have the first failure call `cancel(err)`. Then `context.Cause(ctx)` in the other fetches says *why* they were cancelled. Compare your code with `golang.org/x/sync/errgroup`'s `WithContext`: what does `errgroup.SetLimit` add?
