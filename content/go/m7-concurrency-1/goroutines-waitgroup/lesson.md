---
{
  "slug": "goroutines-waitgroup",
  "title": "main doesn't wait",
  "concepts": ["goroutines", "waitgroup"],
  "requires": ["goroutines"],
  "trap": {
    "concept": "goroutines",
    "question": "main starts a goroutine that takes 10ms, prints its own line, and returns. What's printed?",
    "kind": "choice",
    "choices": [
      "main exits\nworker done",
      "worker done\nmain exits",
      "main exits",
      "main exits\nfatal error: all goroutines are asleep - deadlock!"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it print `[2 6 9]`. main (lines 9–12) is locked.",
    "lockedLines": [9, 10, 11, 12]
  },
  "challenge": {
    "prompt": "Make `TotalSize` call the slow `size` function for all paths concurrently, wait for every call, and return the sum.",
    "entry": "starter.go"
  }
}
---

## Provoke

`go func() { ... }()` starts a function running concurrently. The goroutine sleeps for 10 milliseconds and then prints. `main` prints its own line and reaches its closing brace.

## Decode

### The program ends when `main` returns

A Go program's life is **`main.main`'s** life. When `main` returns, the runtime calls `exit`. It doesn't check for other goroutines, doesn't wait for them, and doesn't run their deferred calls. The sleeping goroutine is simply gone, mid-sleep.

That's different from threads in many runtimes, where the process waits for non-daemon threads. Go has no "non-daemon" goroutine. **If you need work to finish, you have to wait for it explicitly.**

### What a goroutine is

A goroutine isn't an OS thread. The runtime's scheduler multiplexes many goroutines onto a few threads. Its model has three parts:

- **G**, a goroutine: a function plus a small stack (a few KB, grown and moved as needed). You can have hundreds of thousands.
- **M**, a machine: an OS thread that executes Go code.
- **P**, a processor: the right to run Go code, plus a local queue of runnable Gs. There are `GOMAXPROCS` Ps, by default one per CPU core.

An M must hold a P to run Gs. `go f()` puts a new G on the current P's run queue and returns *immediately*. Goroutines are **preempted** and **parked**: a G that sleeps, waits on a channel, or blocks on I/O is set aside without holding a thread, and another G runs. When an M blocks in a system call, its P is handed to another M so the other goroutines keep running. Idle Ps **steal** work from busy Ps' queues.

### Waiting: `sync.WaitGroup`

A `WaitGroup` is a counter with a blocking `Wait`:

- `wg.Add(n)` adds n before starting work, and `wg.Done()` subtracts one when a piece finishes.
- `wg.Wait()` blocks until the counter is zero.
- Since Go 1.25, `wg.Go(f)` does `Add(1)`, starts `f` in a goroutine, and calls `Done` when `f` returns. That removes the classic bugs of forgetting `Done` or calling `Add` inside the goroutine (where `Wait` might run first).

```go verified id=waitgroup-go
package main

import (
	"fmt"
	"runtime"
	"sync"
	"time"
)

func main() {
	fmt.Println("goroutines at start:", runtime.NumGoroutine())
	var wg sync.WaitGroup
	for i := range 3 {
		wg.Go(func() {
			time.Sleep(time.Duration(3-i) * 10 * time.Millisecond)
			fmt.Println("worker", i, "done")
		})
	}
	fmt.Println("goroutines running:", runtime.NumGoroutine())
	wg.Wait()
	fmt.Println("all done")
}
```

The workers finish in reverse order because their sleeps are staggered 10ms apart. Goroutines give no ordering guarantee on their own. Real ordering needs real synchronization.

A `WaitGroup` answers only "are they done?". It doesn't carry results or errors. For results, each goroutine writes **its own** slot (a distinct slice index, as in the Rebuild), or sends on a channel (next lesson). Two goroutines writing the *same* variable is a data race (M8).

**Engine note:** the in-browser engine runs every goroutine on a single thread (`GOMAXPROCS` is 1), so nothing runs truly in parallel there. Scheduling, sleeping, waiting and every output in this lesson are the same as native Go, but a program can't get faster by using more cores in the browser.

## Python/JS contrast

- **Python**: `threading.Thread` is non-daemon by default, so the interpreter *waits* for it at exit. Only `daemon=True` threads get killed, which is Go's only behavior. `asyncio.create_task` is closer to a goroutine (cheap, scheduled by a runtime), and pending tasks are also cancelled when `asyncio.run` finishes.
- **JavaScript**: `setTimeout` or an unresolved promise keeps Node alive until the callbacks run. Go doesn't keep the process alive for pending goroutines.
- **False friend:** `go f()` isn't "run f in the background and it'll finish". It's "start f, and it gets whatever time is left before `main` returns".

## Rebuild

`measure` has a `WaitGroup` and calls `Wait`, yet it returns before any goroutine has written its length. `main` is locked.

## Challenge

`TotalSize` sums sizes one call at a time. The hidden tests give it a `size` function that blocks until **all** expected calls have started, or gives up after 300ms and records that the calls ran one at a time. They also check that `TotalSize` returns only after every call finished, and that the sum is right.

## Stretch

Start 100,000 goroutines that each sleep for a second, and print `runtime.NumGoroutine()` and memory use (`runtime.ReadMemStats`, `Sys`) locally. Compare with starting 10,000 `threading.Thread`s in Python. What does each cost per unit, and where does a goroutine's stack live?
