---
{
  "slug": "sync-primitives",
  "title": "Mutex, RWMutex, Once, atomics",
  "concepts": ["sync-primitives"],
  "requires": ["goroutines"],
  "trap": {
    "concept": "sync-primitives",
    "question": "GetOrSet locks the cache's mutex, then calls Has, which locks the same mutex. One goroutine. What happens? (The runtime's first stderr line counts as output.)",
    "kind": "choice",
    "choices": [
      "go",
      "go\ngo",
      "fatal error: all goroutines are asleep - deadlock!",
      "panic: sync: mutex already locked by this goroutine"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it print `true 70 30`. main (lines 8–12) is locked.",
    "lockedLines": [8, 9, 10, 11, 12]
  },
  "challenge": {
    "prompt": "Make `Inventory` safe for many goroutines: `Load` runs at most once even under concurrent first calls, and `Reserve` never sells more tickets than exist.",
    "entry": "starter.go"
  }
}
---

## Provoke

`Cache` protects its map with a `sync.Mutex`. `GetOrSet` takes the lock, then calls the public `Has` method, which also takes the lock. It's all one goroutine, calling its own methods.

## Decode

### A Go mutex has no owner

`sync.Mutex` is two states, locked and unlocked, plus a queue of goroutines waiting for it. It does **not** record *which* goroutine locked it. So when `Has` calls `Lock` on a mutex that's already locked, the mutex can't tell that the caller is the same goroutine that holds it. It parks the caller until someone unlocks. The only goroutine that would ever unlock it is the one now parked. Every goroutine is asleep, and the runtime reports a deadlock (in a server with other goroutines alive, it would hang instead).

Go chose non-reentrant locks on purpose. A reentrant lock lets a method call another method *in the middle of changing* the data, while the invariants are broken, and the second method assumes they hold. Go's answer is structural: **public methods lock, private helpers assume the lock is held**, and helpers never call public methods. The Rebuild is that fix.

Because a mutex is just state, **copying one copies its state**. A struct holding a `sync.Mutex` must be passed by pointer, which is why M4 said to use pointer receivers when a struct contains one (`go vet`'s `copylocks` check catches the copies).

### The toolbox

- **`sync.Mutex`**: one goroutine at a time in the critical section.
- **`sync.RWMutex`**: any number of readers (`RLock`) *or* one writer (`Lock`). It only helps when reads vastly outnumber writes and the critical sections are long enough to matter. Otherwise its extra bookkeeping makes it slower than a plain `Mutex`.
- **`sync.Once`**: runs a function exactly once, even when many goroutines call `Do` at the same time. The others **block until the first call returns**, so nobody sees half-initialized state. If the function panics, `Once` still counts it as done:

```go verified id=once
package main

import (
	"fmt"
	"sync"
)

func main() {
	var once sync.Once
	func() {
		defer func() { fmt.Println("recovered:", recover()) }()
		once.Do(func() {
			fmt.Println("loading config")
			panic("config file missing")
		})
	}()
	once.Do(func() { fmt.Println("loading config again") })
	fmt.Println("done")

	port := sync.OnceValue(func() int {
		fmt.Println("computing port")
		return 8080
	})
	fmt.Println(port(), port())
}
```

- **`sync/atomic`** (`atomic.Int64`, `atomic.Bool`, `atomic.Pointer[T]`): single-word operations that are indivisible without any lock, like `Add`, `Load`, `Store` and `CompareAndSwap`. They're good for counters and flags, and useless for anything that spans two values.

### Atomic operations don't make a program atomic

The real bug in concurrent code usually isn't two writes landing at the same instant. It's **check-then-act**: read "1 seat left", do something slow, write "0 seats left". Every individual map access can be locked and the program still oversells, because another buyer read "1 seat left" in between. **The critical section has to cover the whole decision.** That's the Challenge, and it's the flash-sale bug in miniature.

## Python/JS contrast

- **Python**: `threading.Lock` is non-reentrant, exactly like Go's `Mutex`, and calling `acquire` twice hangs. `threading.RLock` is the reentrant one, and Go deliberately has no equivalent. The GIL makes single bytecode operations atomic, which hides some races that Go exposes.
- **JavaScript**: single-threaded, so there are no locks. But check-then-act races are just as real across an `await`: read the stock, `await db.save()`, and another request interleaves.
- **False friend:** "everything I touch is inside a lock, so it's thread-safe". Safety comes from where the critical section *begins and ends*, not from the lock calls existing.

## Rebuild

`Transfer` holds `a.mu` and calls `a.Balance()`, which locks `a.mu` again. `main` is locked.

## Challenge

`Inventory` is shared by many goroutines. The hidden tests call `Stock` from 20 goroutines while a slow `Load` is running, and count the loads. Then 50 buyers race for 10 seats while `OnCheck` sleeps between reading and writing the stock. Exactly 10 must succeed.

## Stretch

Rewrite `Reserve` without a mutex, using `atomic.Int64` per item and a `CompareAndSwap` retry loop. Does it still handle `OnCheck` correctly? What does "optimistic concurrency" mean for a database `UPDATE ... WHERE stock >= n`, and why is that the version a real ticketing system uses?
