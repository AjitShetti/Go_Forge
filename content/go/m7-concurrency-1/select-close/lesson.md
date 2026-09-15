---
{
  "slug": "select-close",
  "title": "select, close, and range over channels",
  "concepts": ["select", "channel-close"],
  "requires": ["goroutines"],
  "trap": {
    "concept": "channel-close",
    "question": "Two values go into a buffered channel, then it's closed. The loop receives four times with v, ok := <-ch. What's printed? (The runtime's first stderr line counts as output.)",
    "kind": "choice",
    "choices": [
      "1 true\n2 true\npanic: receive from closed channel",
      "1 true\n2 true\n0 false\n0 false",
      "1 false\n2 false\n0 false\n0 false",
      "1 true\n2 true\nfatal error: all goroutines are asleep - deadlock!"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `1`, `4`, `9`, `done`. main (lines 5–12) is locked.",
    "lockedLines": [5, 6, 7, 8, 9, 10, 11, 12]
  },
  "challenge": {
    "prompt": "Write `Merge(a, b, timeout)`: collect values from both channels in arrival order until both are closed, or until the timeout (counted from the start) runs out.",
    "entry": "starter.go"
  }
}
---

## Provoke

A channel with room for 3 gets two values, and then `close(ch)`. The loop receives **four** times, using the two-value form `v, ok := <-ch`.

## Decode

### `close` means "no more values", not "gone"

Closing a channel doesn't throw away what's in it, and it doesn't make receives fail. It sets a flag in the channel that says **no more sends will ever happen**. From then on:

- Receives first **drain the buffer**: `1 true`, `2 true`. `ok` is `true` because these values were really sent.
- Once it's empty, every receive **returns immediately** with the element type's zero value and `ok == false`, forever. No blocking, no panic.
- `for v := range ch` is sugar for "receive until `ok` is false", so ranging over a channel ends exactly when it's closed *and* drained. Forget to close, and the range waits forever. That's the Rebuild.

The asymmetric rules are where programs break:

- **Sending** on a closed channel panics.
- **Closing** a closed channel panics, and so does closing a nil channel.
- So **the sender closes**, and only one sender. The receiver can't know whether more values are coming. Multiple senders need a separate signal (a `sync.WaitGroup` that closes after all of them finish).

### `select` waits on several channel operations

`select` blocks until **one** of its cases can proceed, then runs that one. If several are ready at the same time, it picks **pseudo-randomly**, so no case can starve the others. A `default` case makes it non-blocking.

Two channel values change how a `select` case behaves:

- A **closed** channel's receive is *always* ready. In a loop, that case wins again and again, returning zeros.
- A **nil** channel's send and receive are *never* ready. `select` skips them.

That's the standard trick for "this input is finished": set the channel variable to `nil`, and its case goes quiet.

```go verified id=nil-and-closed
package main

import "fmt"

func main() {
	var nilCh chan int
	closed := make(chan int)
	close(closed)
	select {
	case v := <-nilCh:
		fmt.Println("nil channel", v)
	case v, ok := <-closed:
		fmt.Println("closed channel", v, ok)
	}
	defer func() { fmt.Println("recovered:", recover()) }()
	close(closed)
}
```

### Timeouts

`time.After(d)` returns a channel that receives once, after `d`. As a `select` case it gives you a timeout, but *where* you call it matters. Inside a loop, each pass creates a new timer, so every value that arrives resets the clock. Created once before the loop, it's a deadline for the whole operation.

## Python/JS contrast

- **Python**: `queue.Queue` has no "closed" state, so producers usually send a sentinel like `None`, and every consumer has to know that convention. `asyncio.wait(..., return_when=FIRST_COMPLETED)` is the nearest thing to `select`. Go builds both into the channel type.
- **JavaScript**: `Promise.race` resembles a one-shot `select`, but it can't be re-armed in a loop, and a promise can't be "closed". Async iterators end with `{done: true}`, which is similar to `range` ending on close.
- **False friend:** a receive on a closed channel isn't an error. It succeeds with a zero value, and without the `ok` it's indistinguishable from a real `0`.

## Rebuild

`produce` sends three squares and returns. `main` ranges over the channel and never reaches `done`. `main` is locked.

## Challenge

`Merge` must watch two channels and a clock. The hidden tests feed values on 30ms and 70ms schedules. They check arrival order, that `Merge` keeps reading after one channel closes, that it returns as soon as both close, and that a 100ms timeout counts from the start of the call, not from the last value.

## Stretch

Write `Merge` for any number of channels: `MergeAll(chans ...<-chan int) <-chan int`, returning a channel. You can't write a `select` with a variable number of cases. Use one goroutine per input and a `WaitGroup` that closes the output when they're all done, then compare with `reflect.Select`.
