---
{
  "slug": "runtime-in-every-binary",
  "title": "The runtime lives in your binary",
  "concepts": ["runtime", "static-linking"],
  "requires": [],
  "trap": {
    "concept": "runtime",
    "question": "Index 5 of a 3-element slice, with a deferred print in front of it. What comes out? (Pick stdout plus the first line of stderr.)",
    "kind": "choice",
    "choices": [
      "before\npanic: runtime error: index out of range [5] with length 3",
      "before\ndeferred\npanic: runtime error: index out of range [5] with length 3",
      "before\nafter\ndeferred",
      "./main.go:10:17: invalid argument: index 5 out of bounds [0:3]"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `total: 6`. Line 6 (the data) is locked.",
    "lockedLines": [6]
  },
  "challenge": {
    "prompt": "Write `At(xs, i)`: Python-style indexing with negative indices that never lets the runtime's bounds check fire. Out of range means `0, false`.",
    "entry": "starter.go"
  }
}
---

## Provoke

Your code never prints the word `panic`, and it never mentions goroutines. Watch what shows up anyway.

## Decode

### The compiler wrote a check you can't see

`xs[i]` doesn't compile to "read memory at `xs + i*8`". The compiler compiles it to roughly this:

```
if uint(i) >= uint(len(xs)) {
    runtime.panicIndex(i, len(xs))   // never returns
}
load xs.ptr[i]
```

Comparing as `uint` catches negative `i` in the same comparison, because a negative number converted to unsigned is huge. The compiler removes the check only when it can *prove* the index is in range. A loop like `for i := 0; i < len(xs); i++` is the common case, so those checks cost nothing.

When the index is a constant and the length is known at compile time, you don't even get as far as running:

```go verified id=const-index
package main

import "fmt"

func main() {
	xs := [3]int{1, 2, 3}
	fmt.Println(xs[5])
}
```

In the trap, `i` is a variable and `xs` is a slice, so the check stays in and fails at run time.

### Who printed all that? The runtime.

`runtime.panicIndex` is a Go function in the `runtime` package. So is everything that happened after it:

1. It builds a value of type `runtime.Error` describing the failure.
2. `gopanic` walks your goroutine's deferred calls and runs them. That's why `deferred` printed *after* `before` and before the crash, while `after` never printed.
3. Nothing called `recover`, so the runtime prints `panic: ` plus the message, then a stack trace for each goroutine (`goroutine 1 [running]`), and exits with status **2**.

That panic value is an ordinary Go value. A deferred `recover` can catch it and inspect it:

```go verified id=runtime-error
package main

import (
	"fmt"
	"runtime"
)

func main() {
	defer func() {
		r := recover()
		err, ok := r.(runtime.Error)
		fmt.Println(ok, err)
	}()
	xs := []int{1, 2, 3}
	i := 5
	_ = xs[i]
}
```

(`recover` gets its own module, M6. Don't use it to paper over bugs like this one.)

### Every binary carries the runtime

The code that did all that is **linked into your executable**, together with the rest of the runtime: the goroutine scheduler, the garbage collector, the map implementation, channel operations, and the code that grows goroutine stacks. Your program doesn't call into an installed VM, because the VM-like parts are compiled Go that the linker copies into every binary.

That's what **static linking** buys you. A Go executable usually runs on a machine with no Go installed, and `scp app server:` is a deployment. It also explains why "hello world" is a few megabytes instead of a few kilobytes. Check it locally: `go build -o hello .` and look at the file size. Code that uses cgo, or some OS services such as the system DNS resolver on certain platforms, can pull in dynamic libraries, so "usually" is doing real work in that sentence.

## Python/JS contrast

- **Python** raises `IndexError`, and the check lives inside the interpreter's C code for list indexing. Python has to be installed on every machine that runs your script. An uncaught exception exits with status 1, and `xs[-1]` is a valid index.
- **JavaScript** doesn't fail at all: `[1, 2, 3][5]` is `undefined`, and the bug surfaces later somewhere else. Node, like Python, has to be installed on the machine.
- **Go** fails at the exact line, exits with **2**, and needs nothing installed. The trade-off is that every binary ships its own copy of the runtime.
- **False friend:** a Go panic looks like an exception and prints a traceback like one. Go code isn't expected to use it for control flow, though: errors are return values (module M6). A panic means "this program has a bug".

## Rebuild

A classic off-by-one. The runtime tells you exactly where it went wrong. Fix the loop, not the data.

## Challenge

Write `At(xs, i)`. The hidden tests cover normal indices, Python-style negative indices, nil slices, huge indices, and one past the end. A panic in any case fails the test run.

## Stretch

Build the trap locally with `go build -gcflags=-d=ssa/check_bce/debug=1 .`: it reports every bounds check the compiler *kept*. Then write a function that sums `xs[0] + xs[1] + xs[2]` and add `_ = xs[2]` on the line before the sum. How many checks does the compiler report before and after, and why?
