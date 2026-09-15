---
{
  "slug": "pointer-receivers",
  "title": "Why the method didn't change anything",
  "concepts": ["value-semantics", "method-receivers"],
  "requires": [],
  "trap": {
    "concept": "method-receivers",
    "question": "Two value-receiver calls, one pointer-receiver call, then a value-receiver call through a pointer. What does it print?",
    "kind": "choice",
    "choices": ["3\n4", "1\n1", "1\n2", "0\n0"],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `balance: 150`. Lines 14–17 in main are locked.",
    "lockedLines": [14, 15, 16, 17]
  },
  "challenge": {
    "prompt": "The starter `Stack` compiles and silently does nothing. Fix its methods so the zero value works as a real stack.",
    "entry": "starter.go"
  }
}
---

## Provoke

`Inc` and `IncPtr` have identical bodies: `c.n++`. The only difference is one `*` in the receiver.

## Decode

### A receiver is just the first parameter

Methods are functions with a special first argument. The compiler treats these two as the same thing:

- `func (c Counter) Inc()` is really `func Inc(c Counter)`
- `func (c *Counter) IncPtr()` is really `func IncPtr(c *Counter)`

You can even call them that way, using *method expressions*:

```go verified id=method-expressions
package main

import "fmt"

type Counter struct{ n int }

func (c Counter) Inc() { c.n++ }

func (c *Counter) IncPtr() { c.n++ }

func main() {
	var c Counter
	Counter.Inc(c)
	(*Counter).IncPtr(&c)
	fmt.Println(c.n)
}
```

The previous lesson's rule applies: **arguments are copied**. `Inc` receives a copy of the struct, increments the copy, and the copy disappears when it returns. `IncPtr` receives a copy of a *pointer*, and writing through that pointer changes `c` itself.

### The two conveniences that hide this

Go writes the `&` and `*` for you at call sites, which is why the trap looks harmless.

1. `c.IncPtr()` on a variable `c` becomes `(&c).IncPtr()`. The compiler takes the address because `c` is **addressable**: it's a variable with a location.
2. `p.Inc()` on a pointer `p` becomes `(*p).Inc()`. It dereferences `p`, and then **copies the struct** into the receiver. Having a pointer in hand doesn't make a value method mutate anything.

So the trap's steps are: two increments of throwaway copies, one real increment (`1`), then one more throwaway copy made through `p` (still `1`).

### Where the first convenience runs out

The automatic `&` only works when there's an address to take. A map element has none: the runtime moves entries around as the map grows, so Go won't let you hold a pointer into one.

```go verified id=not-addressable
package main

import "fmt"

type Counter struct{ n int }

func (c *Counter) IncPtr() { c.n++ }

func main() {
	m := map[string]Counter{"a": {}}
	m["a"].IncPtr()
	fmt.Println(m)
}
```

The usual fix is to store pointers in the map (`map[string]*Counter`), or to copy the value out, modify it, and store it back.

### Choosing a receiver

- Use a **pointer receiver** if the method modifies the receiver, if the struct is large enough that copying it on every call matters, or if it contains something that must not be copied, like a `sync.Mutex`.
- Use a **value receiver** for small, immutable-feeling types (`time.Time` is one).
- Don't mix the two on one type without a reason. Module M4 shows how the choice decides which interfaces a type satisfies.

## Python/JS contrast

- **Python**: `self` is always a reference to the one object. `self.n += 1` changes the instance, and there's no way to receive a copy by accident.
- **JavaScript**: `this` is the same kind of reference. `this.n++` changes the object.
- **False friend:** Go's receiver *looks* like `self`, and `c.Inc()` reads exactly like a Python method call. But whether you get `self` (a pointer) or a snapshot (a value) is decided by one character in the method declaration, and the call site looks the same either way. Nothing warns you: `c.Inc()` compiles, runs and does nothing.

## Rebuild

A bank account that never gets any money. Every line of `main` is locked. Fix it in the method.

## Challenge

The starter `Stack` has value receivers everywhere. The hidden tests push and pop through a zero-value `Stack` variable, a struct field and a pointer, and check LIFO order, `Len`, and popping from an empty stack.

## Stretch

Give `Stack` a `sync.Mutex` field so it's safe to use from several goroutines, and add `func (s Stack) Peek() int` with a value receiver that locks the mutex. Run `go vet` on it locally. What does vet report, and what would go wrong at run time if you ignored it?
