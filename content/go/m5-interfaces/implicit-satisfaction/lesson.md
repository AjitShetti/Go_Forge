---
{
  "slug": "implicit-satisfaction",
  "title": "No implements keyword",
  "concepts": ["implicit-interfaces"],
  "requires": [],
  "trap": {
    "concept": "implicit-interfaces",
    "question": "Status is an int with a String method, and also an Error method. Nothing says Status is an error. What does it print?",
    "kind": "choice",
    "choices": [
      "404\n404",
      "status 404\n404",
      "request failed with 404\n404",
      "request failed with 404\nstatus 404"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it compile and print `3`. main (lines 8–13) is locked.",
    "lockedLines": [8, 9, 10, 11, 12, 13]
  },
  "challenge": {
    "prompt": "Write `Summary(shapes)`: one line per shape, `area X`, plus `, perimeter Y` only for shapes that also have a `Perimeter() float64` method.",
    "entry": "starter.go"
  }
}
---

## Provoke

`Status` has two methods, `String` and `Error`. Nowhere does the code say "Status implements error" or "Status is a Stringer". `fmt.Println` gets the value.

## Decode

### Having the methods *is* implementing the interface

Go has no `implements` clause. A type satisfies an interface when its **method set contains every method the interface lists, with the exact same signatures**. That's it. `Status` has `Error() string`, so `Status` is an `error`, whether or not its author meant that.

`fmt.Println` receives `code` as an `any`. Before formatting, `fmt` asks the value what it can do, in a fixed order: first "are you an `error`?", then "are you a `fmt.Stringer`?". `Status` answers yes to the first, so `Error()` wins and `String()` never runs. The second line converts to a plain `int` first, which has no methods, so it prints `404`.

### How "asking" works at runtime

`fmt` asks with a **type assertion to an interface**: `v.(error)`. The interface value `v` already carries its dynamic type (the type word from the last lesson). The runtime checks that type's method set against the method list of `error`. On success, it builds an **itab**, a small table pointing at the concrete type's `Error` method, and caches it, so later assertions for the same pair are a lookup.

Compile time does the same check whenever the types are already known. That's why the Rebuild fails to compile: `fmt.Fprintf` needs an `io.Writer`, and the compiler compares method signatures and reports the mismatch precisely (`have Write(string) int, want Write([]byte) (int, error)`).

The standard library uses runtime assertions everywhere to discover **optional capabilities**. `io.Copy` checks whether your reader also implements `io.WriterTo`, because then it can skip its own buffer:

```go verified id=optional-capabilities
package main

import (
	"fmt"
	"io"
	"strings"
)

type onlyReader struct{ r io.Reader }

func (o onlyReader) Read(p []byte) (int, error) { return o.r.Read(p) }

func main() {
	var r io.Reader = strings.NewReader("hello")
	_, fast := r.(io.WriterTo)
	_, seek := r.(io.Seeker)
	fmt.Println(fast, seek)

	r = onlyReader{strings.NewReader("hello")}
	_, fast = r.(io.WriterTo)
	fmt.Println(fast)
}
```

`*strings.Reader` never mentions `io.WriterTo`. It just has a `WriteTo` method. Wrap it in a type that only has `Read`, and the capability disappears.

### Consequences worth knowing

- **Define interfaces where they're used**, not next to the types. The consumer decides which methods it needs, and any type with those methods fits, including types from packages that have never heard of your interface.
- **Keep them small.** `io.Reader` has one method, so almost anything can be a reader.
- **Accidental satisfaction is real.** A type that happens to have `Error() string` gets printed as an error. If you want a compile-time promise that a type satisfies an interface, write `var _ io.Writer = (*LineCounter)(nil)` next to it. That line compiles only while the promise holds.

## Python/JS contrast

- **Python**: this is duck typing, like `__str__` or anything with a `read()` method passed to code that calls `.read()`. The difference: Python checks when the method is *called*, while Go checks when the value is *converted* to the interface, at compile time if it can. A mistyped signature is a compile error in Go and a runtime `TypeError` (or silent misbehavior) in Python. `typing.Protocol` is the closest match: structural, and checked by a type checker instead of by the language.
- **JavaScript**: the same duck typing, with no check at all until the call.
- **False friend:** Java's and TypeScript's `implements`. In TypeScript, interfaces are also structural, but TypeScript checks shapes only while compiling. Go keeps enough type information in interface values to ask again at runtime.

## Rebuild

`LineCounter` was meant to be an `io.Writer`, but its `Write` has the wrong signature, so the program doesn't compile. `main` is locked. Nothing needs declaring; make the method match.

## Challenge

`Summary` gets `[]Shape`, where a `Shape` only promises `Area()`. The hidden tests define the shapes themselves, so your code can't name them. It has to ask each value whether it can also report a perimeter. One test shape has a `Perimeter` method with the wrong signature, and one has pointer-receiver methods.

## Stretch

Add `var _ fmt.Stringer = Status(0)` and `var _ error = Status(0)` to the trap, then change `Error()`'s signature to return `[]byte`. Which line does the compiler point at now, and why is that a better error than whatever `fmt` would print?
