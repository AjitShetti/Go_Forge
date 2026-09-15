---
{
  "slug": "panic-recover",
  "title": "When panic is correct, where recover works",
  "concepts": ["panic-recover"],
  "requires": [],
  "trap": {
    "concept": "panic-recover",
    "question": "safely defers a function that calls logRecover, and logRecover calls recover(). Then safely writes to a nil map. What happens? (The runtime's first stderr line counts as output.)",
    "kind": "choice",
    "choices": [
      "recovered: assignment to entry in nil map\nafter\nmain done",
      "main done\npanic: assignment to entry in nil map",
      "recovered: assignment to entry in nil map\nmain done",
      "panic: assignment to entry in nil map"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `/ok 200`, `/boom 500`, `/ok 200`. main (lines 5–9) is locked.",
    "lockedLines": [5, 6, 7, 8, 9]
  },
  "challenge": {
    "prompt": "Make `Eval` return syntax errors instead of panicking, by recovering only the parser's own `parseError` panics. Anything else, like division by zero, must keep panicking.",
    "entry": "starter.go"
  }
}
---

## Provoke

`safely` sets up a deferred function, and that function calls a helper, `logRecover`, which calls `recover()`. Then `safely` writes to a nil map, which panics (M3). `main` has its own deferred print.

## Decode

### What a panic does

A panic **unwinds the goroutine's stack**. The function that panicked stops, its deferred calls run, then its caller stops and *its* deferred calls run, and so on up to the top of the goroutine. If nothing stops it, the runtime prints `panic: ...` plus the stack and exits the whole program with status 2. That's why `main done` still printed: `main`'s deferred call ran on the way out.

### Where `recover` actually works

`recover()` stops a panic **only when it's called directly by a deferred function, while that goroutine is panicking**. Everywhere else it returns `nil` and does nothing:

- In normal code (no panic in progress): `nil`.
- In a function called **by** the deferred function, like `logRecover` here: `nil`. The runtime checks that `recover`'s caller *is* the deferred call frame, not just something running during the unwind.
- In another goroutine: `nil`. Each goroutine unwinds alone, and a panic in a goroutine you started kills the program even if `main` has a `recover`.

So the deferred function ran, called `logRecover`, and `recover` returned `nil`. The panic kept going.

When `recover` does work, it returns the value passed to `panic`. Runtime failures (nil map write, index out of range, division by zero) panic with a `runtime.Error`:

```go verified id=recover-values
package main

import (
	"fmt"
	"runtime"
)

func try(f func()) (r any) {
	defer func() {
		r = recover()
	}()
	f()
	return nil
}

func main() {
	fmt.Println(try(func() {}))

	r := try(func() {
		var s []int
		_ = s[3]
	})
	_, isRuntime := r.(runtime.Error)
	fmt.Println(r, isRuntime)

	fmt.Println(try(func() { panic(fmt.Sprintf("bad state %d", 7)) }))
}
```

After a successful `recover`, the function whose deferred call recovered returns **normally** to its caller, with whatever its named results hold. That's how `serve` in the Rebuild can report `500`.

### When panic is the right tool

Errors are values in Go (the last three lessons), and ordinary failures are returned. `panic` is for:

- **Programmer bugs and broken invariants**: an impossible `switch` default, a nil map you promised was initialized. There's no sensible caller-level handling.
- **Initialization that can't fail at runtime**: `regexp.MustCompile` on a constant pattern, templates parsed at startup.
- **Unwinding out of deep recursion inside one package**, like a parser. `encoding/json` and `text/template` do this internally, and convert **only their own** panic type into an error at the exported function. Anything else is re-panicked, so real bugs aren't disguised as bad input.

Recovering at a **boundary** is also legitimate: `net/http` recovers each request's handler so one bug doesn't kill the server. That's the Rebuild.

## Python/JS contrast

- **Python**: exceptions *are* the normal error path, and `except Exception:` anywhere up the stack catches them, including in helpers called from `except` blocks. Go's `recover` is deliberately awkward: only a deferred function calling it directly works.
- **JavaScript**: `try/catch` also catches at any depth. An unhandled rejection in a promise is roughly Go's "panic in another goroutine", except Node logs it, while Go exits.
- **False friend:** `recover()` looks like a general "catch" you can put in a utility function. Put it in a helper and it silently stops working.

## Rebuild

A handler dereferences a nil pointer, and it takes the whole loop down. `main` is locked. Make `serve` turn a handler panic into status 500.

## Challenge

`Eval` wraps a recursive-descent parser that reports syntax errors by panicking with `parseError`. The hidden tests check valid expressions, check that six malformed ones return errors (and don't panic), check the exact message, and check that `1/0` still panics with a `runtime.Error`.

## Stretch

Start a goroutine that panics, and try to recover it from `main` with a deferred `recover`. It won't work. Write `Go(f func()) <-chan error` that runs `f` in a goroutine, recovers there, and delivers the panic as an error. Should it include the stack (`runtime/debug.Stack()`)? What would a caller do with it?
