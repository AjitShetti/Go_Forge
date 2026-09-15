---
{
  "slug": "channels",
  "title": "Unbuffered channels are a handshake",
  "concepts": ["channels", "deadlock"],
  "requires": ["goroutines", "deadlockDetection"],
  "trap": {
    "concept": "channels",
    "question": "main makes a channel, sends 1 into it, then receives it back. One goroutine, no buffer size given. What happens? (The runtime's first stderr line counts as output.)",
    "kind": "choice",
    "choices": [
      "1",
      "0",
      "fatal error: all goroutines are asleep - deadlock!",
      "panic: send on channel with no receiver"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it print `got 10`, `got 20`, `finished`. main (lines 5–13) is locked.",
    "lockedLines": [5, 6, 7, 8, 9, 10, 11, 12, 13]
  },
  "challenge": {
    "prompt": "Write `First(fns...)`: run every fn concurrently, return the first result without waiting for the rest, and leave no goroutine blocked forever.",
    "entry": "starter.go"
  }
}
---

## Provoke

`make(chan int)` with no size. `main` sends `1` into the channel, then plans to receive it on the next line. There's only one goroutine.

## Decode

### An unbuffered channel holds nothing

A channel isn't a queue you drop things into. `make(chan int)` has **zero capacity**: a send can't finish until another goroutine is **at the same moment** receiving, and the value passes hand to hand. That's why it's called a *synchronous* channel, or a handshake. The send and the receive complete together.

`ch <- 1` in `main` waits for a receiver. The only code that would receive is the next line, which `main` can't reach because it's stuck on this one. Nothing else can run, so nothing will ever change.

### What the runtime knows

Internally a channel is an `hchan` struct: a lock, an optional ring buffer, and two queues of **parked goroutines**, the waiting senders and the waiting receivers. A send on an unbuffered channel with no waiting receiver parks the sending goroutine on the send queue, and the scheduler runs something else.

When the scheduler finds **no goroutine that can ever run again** (every one is parked on channels or locks, and no timers or network I/O are pending that could wake one), it knows the program can't make progress. It stops with `fatal error: all goroutines are asleep - deadlock!` and dumps each goroutine with the reason it's parked (`[chan send]`).

Two things about that message:

- It's a **fatal error**, not a panic. `recover` can't catch it, and deferred calls don't run.
- It's **best effort**. If *any* goroutine could still wake up (one blocked in `time.Sleep`, one waiting on a network connection), the runtime can't prove a deadlock, and the program just hangs. In a real server, a deadlock usually looks like a hang, not like this message.

### Buffered channels

`make(chan int, 2)` has room for two values. A send succeeds immediately while there's room, and blocks when the buffer is full. A receive takes from the buffer, and blocks when it's empty. `len` and `cap` report fill and size:

```go verified id=buffered
package main

import "fmt"

func main() {
	defer func() {
		fmt.Println("recovered:", recover())
	}()
	ch := make(chan int, 2)
	ch <- 1
	ch <- 2
	fmt.Println(len(ch), cap(ch))
	fmt.Println(<-ch, len(ch))
	ch <- 3
	ch <- 4
}
```

The third send fills the buffer again, and the fourth has nowhere to go: deadlock, and the deferred `recover` never prints.

A buffer changes **when** senders block, not **whether** you need a receiver. Use it when you know how many values will pile up (like `First`, where every loser's result has somewhere to land), not to make a deadlock go away.

## Python/JS contrast

- **Python**: `queue.Queue()` with no `maxsize` is *unbounded*, so `put` never blocks. Go's `make(chan T)` is the opposite end, capacity zero, and the closest Python equivalent is a `Queue(maxsize=1)` plus a `join()`. Python has no deadlock detector: a stuck `get()` just hangs.
- **JavaScript**: there's no blocking at all. An unresolved promise never settles, and Node exits when nothing is pending, silently.
- **False friend:** "channel" sounds like a pipe with some capacity. The default capacity is zero, and it's a rendezvous.

## Rebuild

A worker takes jobs from `main` and signals `done` in between, while `main` is still trying to hand over the second job. Each side waits for the other. `main` is locked.

## Challenge

`First` has to race several functions. The hidden tests check that the fastest result wins, that `First` doesn't wait for a 400ms function, and that after every function has returned, **no goroutine is still running**. That last check catches senders stuck on a channel nobody reads.

## Stretch

Make a deadlock the runtime can't detect: add `go func() { time.Sleep(time.Hour) }()` to the trap and run it locally. It hangs instead of crashing. Send the process `SIGQUIT` (Ctrl+\ on Unix) to get the goroutine dump anyway, and find `main` in it.
