---
{
  "slug": "escape-analysis",
  "title": "Who decides stack or heap",
  "concepts": ["escape-analysis"],
  "requires": ["escapeAnalysis"],
  "trap": {
    "concept": "escape-analysis",
    "question": "testing.AllocsPerRun counts heap allocations per call. One function returns a struct, the other returns a pointer to one. What does it print?",
    "kind": "choice",
    "choices": ["0 0", "0 1", "1 1", "1 0"],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `allocs per call: 0`. Lines 18–21 are locked.",
    "lockedLines": [18, 19, 20, 21]
  },
  "challenge": {
    "prompt": "Write `Fields(dst, s)`: split s on spaces and append the words to dst. When dst has room, it must make zero heap allocations. A hidden test measures that.",
    "entry": "starter.go"
  }
}
---

## Provoke

Two functions build the same two-int struct. One hands back the struct, the other hands back its address. (`//go:noinline` stops the compiler from pasting the function into its caller, which would hide the difference.)

## Decode

### The compiler decides, not you

C makes you choose: local variables live on the stack, and `malloc` puts things on the heap. Go has no `malloc` and no `new`-means-heap rule. You write `&point{x, y}` or `return point{x, y}`, and the **compiler decides where the memory lives** using **escape analysis**.

The question it asks about every value is: *can this value be reached after the function that created it returns?*

- `byValue` returns a `point`. The caller gets a *copy* of the bytes (the return value is copied into the caller's frame), so nothing outside `byValue` points into its stack frame. The value can live on the stack: **0 allocations**.
- `byPointer` returns `&point{...}`, an address. The caller will use that address after `byPointer`'s stack frame is gone, so the value **escapes** and has to go on the heap: **1 allocation** per call.

In C, returning the address of a local is a dangling-pointer bug. In Go it's safe, because the compiler notices and moves the value to the heap.

### Asking the compiler

The `-m` flag makes the compiler print its decisions. This app runs the real compiler, so the output below is what `go build -gcflags=-m` prints:

```go verified id=escape-m mode=build gcflags=-m
package main

type point struct{ x, y int }

//go:noinline
func byValue(x, y int) point {
	return point{x, y}
}

//go:noinline
func byPointer(x, y int) *point {
	return &point{x, y}
}

var sink *point

func main() {
	a := byValue(1, 2)
	sink = byPointer(a.x, a.y)
}
```

`&point{...} escapes to heap` is the line for `byPointer`. `byValue` gets no line, because nothing in it escapes.

### Why it matters

A stack allocation is almost free: the frame already exists, and the memory is reclaimed when the function returns. A heap allocation costs the allocator's time, and it's garbage the GC has to find later. In a hot loop, "returns a pointer" versus "returns a value" can be the difference between zero garbage and millions of objects.

Common reasons a value escapes:

- Its address is returned, or stored somewhere that outlives the function (a global, a heap object, a channel).
- It's put in an interface value and the compiler can't prove the interface doesn't escape. `fmt.Println(x)` often causes this.
- It's captured by a closure that outlives the function.
- Its size isn't known at compile time, or it's too big for the stack (`make([]byte, n)` with a variable `n`).

Escape analysis is conservative: when it can't prove a value stays local, the value goes to the heap. Measure with `-m` and benchmarks before rewriting code for it.

## Python/JS contrast

- **Python**: every object is on the heap, every time. `Point(1, 2)` allocates, and even small integers are objects (CPython caches -5 to 256). There's no stack/heap decision to make, and no way to avoid the allocation.
- **JavaScript**: V8 allocates objects on its heap. Its optimizing compiler can sometimes eliminate an allocation ("escape analysis" exists in V8 too), but that happens invisibly at run time and depends on how warm the code is.
- **False friend:** `&T{}` looks like `new T()` in JS or Java, and people assume "pointer means heap". In Go it doesn't. A pointer that never leaves the function can point at stack memory, and a value you never took the address of can still escape if it's stored in an interface.

## Rebuild

`newPoint` returns a pointer, so every call allocates. The four lines of the measurement are locked. Change what `newPoint` returns, and what `sink` is, so the count drops to zero.

## Challenge

Write `Fields(dst, s)`. One hidden test calls it through `testing.AllocsPerRun` with a `dst` that has plenty of spare capacity, and requires exactly 0 allocations. The others check the words.

## Stretch

Write a benchmark locally with `b.ReportAllocs()` for the starter and for your solution, and compare allocs/op. Then change your solution to return words as `string([]byte(s[start:i]))` instead of `s[start:i]`. Predict the new allocs/op for a four-word input before you run it.
