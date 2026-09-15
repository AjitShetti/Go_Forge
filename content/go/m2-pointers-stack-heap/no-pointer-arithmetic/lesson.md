---
{
  "slug": "no-pointer-arithmetic",
  "title": "Pointers without arithmetic",
  "concepts": ["pointers"],
  "requires": [],
  "trap": {
    "concept": "pointers",
    "question": "In C, p++ moves a pointer to the next array element. What does Go do?",
    "kind": "choice",
    "choices": [
      "20",
      "./main.go:8:2: invalid operation: p++ (non-numeric type *int)",
      "11",
      "panic: runtime error: invalid memory address or nil pointer dereference"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `sum: 60`. Line 6 (the data) is locked.",
    "lockedLines": [6]
  },
  "challenge": {
    "prompt": "Reverse a linked list in place. The hidden tests check that you relinked the original nodes, compared by address.",
    "entry": "starter.go"
  }
}
---

## Provoke

A C programmer's reflex: take the address of the first element, then walk forward with `p++`.

## Decode

### What Go pointers can do

A Go pointer holds an address, just like in C. You can take one (`&x`), follow one (`*p`), compare two with `==`, and pass them around. That's the whole list. `p++`, `p + 1` and `p - q` don't compile, because arithmetic isn't defined on pointer types.

### Why: the runtime has to understand every pointer

Go leaves out arithmetic so the runtime can keep promises that C can't:

1. **The garbage collector needs to know what's live.** It finds live memory by following pointers. If `p + 3` were legal, a pointer could point past the end of its object, or into the middle of a different one, and the GC couldn't tell which object is being kept alive.
2. **Goroutine stacks move.** Stacks start small and get *copied* to a bigger block when they grow. The runtime then rewrites every pointer into the old stack. That only works if every pointer is a plain, known reference to a real variable, not a computed offset.
3. **Memory safety without checks on every dereference.** With no arithmetic, a non-nil pointer always points at a whole value of the right type. Indexing goes through slices, and those have bounds checks (module M0).

Because the GC tracks pointers, you can do things that are bugs in C. Returning the address of a local is fine, since escape analysis moves the variable to the heap:

```go verified id=return-local-address
package main

import "fmt"

func counter() *int {
	n := 0
	return &n
}

func main() {
	a := counter()
	b := counter()
	*a += 5
	fmt.Println(*a, *b)
}
```

A pointer keeps its target alive even after the slice it came from moves on. This one is a real Go gotcha:

```go verified id=stale-element-pointer
package main

import "fmt"

func main() {
	s := make([]int, 1, 1)
	p := &s[0]
	s = append(s, 2)
	*p = 99
	fmt.Println(s[0], *p)
}
```

`append` needed more capacity, so it copied `s` into a new array. `p` still points into the **old** array, and the GC keeps that array alive for as long as `p` exists. Writing through `p` changes memory `s` no longer uses.

### The escape hatch is named `unsafe`

When you truly need offsets (for syscalls, binary formats, or runtime internals), the `unsafe` package has `unsafe.Pointer` and `unsafe.Add`. The offset is in **bytes**, not elements, which is a difference from C's `p + 1`:

```go verified id=unsafe-add
package main

import (
	"fmt"
	"unsafe"
)

func main() {
	xs := [3]int{10, 20, 30}
	p := unsafe.Pointer(&xs[0])
	second := (*int)(unsafe.Add(p, unsafe.Sizeof(xs[0])))
	fmt.Println(*second, unsafe.Sizeof(xs[0]))
}
```

The package name is the warning. Code that imports `unsafe` gives up the guarantees above, and the Go 1 compatibility promise doesn't cover it.

## Python/JS contrast

- **Python** and **JavaScript** have no pointers you can see. Every variable holding an object is effectively a pointer the runtime manages, and you can't take the address of a variable or an element at all. Go gives you explicit pointers, which is more control than Python has, but still no arithmetic, which is less than C.
- `id(x)` in CPython happens to be a memory address, but you can't dereference it. The closest Go equivalent is printing `%p`.
- **False friend:** `*p` and `&x` look like C, and people coming from C expect C's powers. People coming from Python often expect pointers to be dangerous. They're neither: Go pointers are references you can see and pass around, with no way to make them point anywhere invalid (short of `unsafe`).

## Rebuild

The loop sums an array the C way. Keep the data and get `sum: 60`. You can keep using pointers if you like, just not arithmetic on them.

## Challenge

Write `Reverse(head)` for a singly linked list. The hidden tests build lists of 0, 1, 2 and 5 nodes, and check that the result is made of *the same node addresses* in reverse order. Building a new list gets the values right and still fails.

## Stretch

Slices do the "walk forward" job that pointer arithmetic does in C. Rewrite the Rebuild so it loops with `for len(rest) > 0 { total += rest[0]; rest = rest[1:] }`. What does `rest = rest[1:]` do to the slice header, and why can't it ever run past the end of `xs`?
