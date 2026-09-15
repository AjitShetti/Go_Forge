---
{
  "slug": "loopvar",
  "title": "The loop variable bug that Go 1.22 removed",
  "concepts": ["loopvar-semantics", "closures"],
  "requires": ["goroutines", "languageVersion"],
  "lang": "go1.21",
  "trap": {
    "concept": "loopvar-semantics",
    "question": "This module's go.mod says `go 1.21`. Each closure prints i, and they're all called after the loop ends. What's printed?",
    "kind": "choice",
    "choices": [
      "0 1 2",
      "3 3 3",
      "2 2 2",
      "0 0 0"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `handling alpha`, `handling beta`, `handling gamma`, still under go 1.21. main (lines 5–10) is locked.",
    "lockedLines": [5, 6, 7, 8, 9, 10]
  },
  "challenge": {
    "prompt": "Under go 1.21, make handler i of `Handlers` return `i:label` for the label it was built with, whenever it's called, even after the caller changes the slice.",
    "entry": "starter.go"
  }
}
---

## Provoke

Three closures are built in a `for` loop, and each prints `i`. They run later, after the loop has finished. The module's `go.mod` declares `go 1.21`. Every program in this lesson runs under that directive, except where a block says otherwise.

## Decode

### A closure captures variables, not values

A function literal that uses `i` doesn't copy `i`'s value into itself. It holds a reference to the **variable** `i`, and reads whatever the variable contains when the closure runs. (If the closure outlives the function, escape analysis from M2 moves `i` to the heap.)

So the real question is: **how many `i` variables are there?**

- **Up to Go 1.21:** one. `for i := 0; i < 3; i++` declares `i` once, and every iteration assigns to it. All three closures share that single variable, which ends at `3`, the value that made `i < 3` false.
- **From Go 1.22:** one **per iteration**. Each pass gets a fresh `i`, initialized from the previous one, so each closure captures its own.

Same source, different programs:

```go verified id=go122 lang=go1.22
package main

import "fmt"

func main() {
	var prints []func()
	for i := 0; i < 3; i++ {
		prints = append(prints, func() { fmt.Print(i, " ") })
	}
	for _, p := range prints {
		p()
	}
	fmt.Println()
}
```

The change covers both `for i := ...; ...; ...` loops and `for i, v := range ...` loops. It was the most common Go bug for a decade, especially with goroutines: `go func() { use(v) }()` inside a range loop, where every goroutine saw the last element (or a mix, depending on scheduling).

### Who decides: the `go` directive

Changing what existing code means is normally off limits in Go. It was done here by tying the new semantics to the **language version**:

- The `go` line in a module's `go.mod` sets the language version for every file in that module. `go 1.21` keeps the old meaning, even when built with the Go 1.27 toolchain. That's why this lesson's trap printed `3 3 3`.
- A single file can declare a newer version with a build constraint. This file gets per-iteration variables inside a `go 1.21` module:

```go verified id=file-version lang=go1.21
//go:build go1.22

package main

import "fmt"

func main() {
	var prints []func()
	for i := 0; i < 3; i++ {
		prints = append(prints, func() { fmt.Print(i, " ") })
	}
	for _, p := range prints {
		p()
	}
	fmt.Println()
}
```

- Dependencies keep **their own** `go.mod` versions, so upgrading your module doesn't silently change a library's loops.

### The fix you'll see in older code

Before 1.22, the idiom was to shadow the variable inside the loop: `n := n`. It declares a new variable per iteration, initialized from the shared one, and the closure captures the new one. In a 1.22+ module it's redundant, and `go fix`'s modernizers remove it. You'll still read it in every codebase older than 2024.

## Python/JS contrast

- **Python**: closures capture variables too, and a `for` loop has one variable for the whole loop. `[lambda: i for i in range(3)]` gives three lambdas that all return 2. The Python fix is a default argument, `lambda i=i: i`, which is the same idea as Go's `i := i`. Python never changed this.
- **JavaScript**: `for (var i ...)` shares one variable (prints `3 3 3`), and `for (let i ...)` creates one per iteration (prints `0 1 2`). ES2015's `let` is exactly what Go 1.22 did, only Go switched on a per-module version instead of new syntax.
- **False friend:** reading an old Go codebase with 1.22 eyes. The same loop means something different depending on a `go.mod` line you might not be looking at.

## Rebuild

`register` builds a handler map in a `go 1.21` module, and every handler reports the last name. Fix it without changing the language version. `main` is locked.

## Challenge

`Handlers` builds click handlers in a `go 1.21` module. The hidden tests call them later, in a different order, and after changing the caller's slice. Both loop variables matter, and so does *what* the handler reads when it runs.

## Stretch

In a `go 1.21` module, start a goroutine per element in `for _, v := range []int{1, 2, 3}` that prints `v`, with a `WaitGroup`. Run it locally 20 times with `-race`. Then switch `go.mod` to `1.22` and run it again. What does the race detector report under 1.21, and why does 1.22 make the race disappear rather than just the wrong output?
