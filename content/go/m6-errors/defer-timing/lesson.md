---
{
  "slug": "defer-timing",
  "title": "defer evaluates arguments now",
  "concepts": ["defer-evaluation"],
  "requires": [],
  "trap": {
    "concept": "defer-evaluation",
    "question": "Two defers both print x: one passes x as an argument, the other reads it inside a closure. x changes to 2 before main returns. What's printed, in what order?",
    "kind": "choice",
    "choices": [
      "body: 2\ndeferred arg: 2\ndeferred closure: 2",
      "body: 2\ndeferred arg: 1\ndeferred closure: 2",
      "body: 2\ndeferred closure: 2\ndeferred arg: 1",
      "body: 2\ndeferred closure: 1\ndeferred arg: 1"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it print `40 <nil>`. main (lines 5–8) is locked.",
    "lockedLines": [5, 6, 7, 8]
  },
  "challenge": {
    "prompt": "Make `Save` close the file on every path, exactly once, and return the first write error or, if there wasn't one, the error from `Close`.",
    "entry": "starter.go"
  }
}
---

## Provoke

Two deferred calls print `x`. The first passes `x` as an argument to `fmt.Println`. The second is a closure that reads `x` when it runs. Between the `defer`s and the end of `main`, `x` becomes `2`.

## Decode

### Two moments: when you write `defer`, and when it runs

A `defer` statement does its work in two parts:

1. **At the `defer` statement**, Go evaluates the function value and **all its arguments**, right then, and saves them.
2. **When the surrounding function returns**, Go calls the saved function with the saved arguments.

`defer fmt.Println("deferred arg:", x)` evaluates `x` immediately, while it's `1`, and saves the `1`. Changing `x` later doesn't reach that saved copy.

`defer func() { fmt.Println("deferred closure:", x) }()` saves a function with **no** arguments. The closure captures the *variable* `x`, not its value, and reads it when it finally runs, after `x = 2`.

The order is **last in, first out**: deferred calls go on a stack, so the closure (deferred second) runs first. That's what makes `defer mu.Unlock()` and `defer f.Close()` unwind in the opposite order of setup.

### Deferred functions run after `return` has set the results

`return expr` isn't atomic. It **stores `expr` into the result**, *then* runs the deferred calls, *then* actually returns. If the result has a **name**, a deferred closure can read and change it. If it's unnamed, the closure can only touch local variables that have already been copied out:

```go verified id=named-results
package main

import "fmt"

func named() (n int) {
	defer func() { n *= 10 }()
	return 4
}

func unnamed() int {
	n := 0
	defer func() { n *= 10 }()
	n = 4
	return n
}

func main() {
	for i := 0; i < 3; i++ {
		defer fmt.Print(i, " ")
	}
	fmt.Println(named(), unnamed())
}
```

`named` returns 40: `return 4` stored 4 in `n`, and the deferred function multiplied it. `unnamed` returns 4: the value was copied to the result before the closure changed the local `n`. The loop's deferred `Print`s evaluated `i` at each `defer`, and ran in reverse.

### The pattern this enables

Cleanup that can fail, like `Close`, `Commit` or `Flush`, should report its error without hiding an earlier one:

```go excerpt=challenge/solution.go
func Save(w io.WriteCloser, lines []string) (err error) {
defer func() {
if cerr := w.Close(); err == nil {
err = cerr
}
}()
```

`defer w.Close()` on its own is fine for read-only files, where closing can't lose data. For anything you *wrote*, it silently discards the one error that says the data never made it.

## Python/JS contrast

- **Python**: `try/finally` and `with` run cleanup at scope exit, but code in `finally` reads variables *when it runs*, like the closure here. There's no equivalent of evaluating the arguments up front. Also, a `return` inside `finally` overrides the function's result, which is a well-known footgun. Go makes that override explicit: it needs a named result.
- **JavaScript**: `try/finally` behaves the same as Python's.
- **False friend:** `defer fmt.Println(x)` *looks* like "print x at the end". It means "print the value x has **now**, at the end".

## Rebuild

`count` defers a function that multiplies the total by 10, but `main` still gets 4. `main` is locked.

## Challenge

`Save` writes lines and must close the file on every path. The hidden tests use a fake file that can fail a write or fail on close. They check that `Close` is called exactly once, that a close error is reported, and that a write error isn't replaced by `Close`'s result.

## Stretch

`defer` inside a loop that opens 10,000 files keeps all of them open until the function returns. Rewrite such a loop so each file is closed at the end of its iteration, and measure the difference with `ulimit -n 256` locally. Why doesn't Go run deferred calls at the end of each block?
