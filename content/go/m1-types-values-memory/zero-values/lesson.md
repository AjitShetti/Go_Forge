---
{
  "slug": "zero-values",
  "title": "Nothing is ever undefined",
  "concepts": ["zero-values"],
  "requires": [],
  "trap": {
    "concept": "zero-values",
    "question": "u is declared and never assigned. The code appends to its nil slice. What does it print?",
    "kind": "choice",
    "choices": [
      "true 0 true true true\n\"\" [admin] 0",
      "false 0 false false true\n\"\" [admin] 0",
      "panic: runtime error: invalid memory address or nil pointer dereference",
      "true 0 true true true\npanic: append to nil slice"
    ],
    "answer": 0
  },
  "rebuild": {
    "goal": "Make it print `warmest: -3`. Line 6 (the data) is locked.",
    "lockedLines": [6]
  },
  "challenge": {
    "prompt": "Write `Port(cfg)`: use the configured port if the key is present, even when it's 0; otherwise use 8080. The starter can't tell \"missing\" from \"set to zero\".",
    "entry": "starter.go"
  }
}
---

## Provoke

A struct that nobody initialized, with a string, an int, a slice, a map and a pointer inside. Then an `append` to the slice.

## Decode

### Zero value means zeroed memory

Go has no "uninitialized" state. When memory is allocated, whether in a stack frame or on the heap, the compiler and the allocator make sure every byte is **zero** before your code can see it. Each type's **zero value** is simply what all-zero bytes mean for that type:

- `int`, `float64`: `0` (IEEE-754 +0.0 is all zero bits).
- `bool`: `false`.
- `string`: a nil data pointer with length 0, which is `""`.
- `*T`, `map`, `chan`, `func`, interfaces: `nil`.
- `[]T`: the header `{ptr: nil, len: 0, cap: 0}`, a nil slice.
- Structs and arrays: every field or element set to its own zero value.

```go verified id=all-zero-values
package main

import "fmt"

func main() {
	var (
		i  int
		f  float64
		b  bool
		s  string
		p  *int
		sl []int
		m  map[string]int
		e  error
		a  [2]bool
	)
	fmt.Printf("%v %v %v %q %v %v %v %v %v\n", i, f, b, s, p, sl, m, e, a)
}
```

The trap's `u` is 5 fields laid out one after another, all zero bytes. Nothing was computed or run. Clearing memory is cheap, and it's how Go promises you will never read garbage.

### Why appending to a nil slice works

`append` checks whether `len + 1 <= cap`. For a nil slice, `cap` is 0, so it allocates a new backing array, copies nothing, adds `"admin"`, and **returns a new slice header**. Assigning that header back to `u.Tags` is what makes it stick. A nil slice needs no special handling because `append` always had to handle "not enough capacity" anyway.

A nil *map* is different, and writing to one panics. Module M3 explains why.

### Useful zero values are a design rule

The standard library designs types so their zero value is ready to use:

```go verified id=useful-zero
package main

import (
	"fmt"
	"strings"
	"sync"
)

func main() {
	var buf strings.Builder
	var mu sync.Mutex
	mu.Lock()
	buf.WriteString("ready")
	mu.Unlock()
	fmt.Println(buf.String(), buf.Len())
}
```

No constructor, no `new Mutex()`. You'll see "make the zero value useful" in Go code reviews for types you write yourself.

### The cost: zero is also real data

Because every variable already holds a valid value, Go can't tell "never set" from "set to zero". The Rebuild shows the bug that causes: a running maximum that starts at `0` is wrong as soon as every value is negative. For maps, the language gives you a second return value to ask whether the key was present, and that's the challenge.

## Python/JS contrast

- **Python**: a name doesn't exist until it's assigned (`NameError`), and attributes don't exist until `__init__` sets them (`AttributeError`). `None` is not a zero value either: `None + 1` raises `TypeError`. Python makes you initialize. Go initializes for you.
- **JavaScript**: `undefined` is everywhere, and `undefined + 1` is `NaN` with no error. JS has an "unset" state that keeps spreading. Go has no unset state, only zeros.
- **False friend:** Go's `nil` looks like `None`/`null`, but a nil slice is a *usable* empty slice: `len` is 0, `range` works, `append` works. Checking `if xs == nil` before appending is Python habit, not Go.

## Rebuild

This "warmest temperature" finder reports `0`, a temperature that isn't in the data. Fix how it starts, not the data.

## Challenge

Write `Port(cfg)`. The hidden tests include a nil config, an empty config, other keys only, and a port explicitly set to `0`, which is a legitimate setting.

## Stretch

`var p *User` is a nil pointer, and `p.Name` panics. Yet a method with a pointer receiver can still be *called* on it. Write `func (u *User) DisplayName() string` that returns `"anonymous"` when `u == nil`, call it on `p`, and explain why the call itself doesn't panic.
