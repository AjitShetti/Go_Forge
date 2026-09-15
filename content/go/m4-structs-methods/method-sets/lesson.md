---
{
  "slug": "method-sets",
  "title": "Method sets decide what satisfies what",
  "concepts": ["method-receivers", "method-sets"],
  "requires": [],
  "trap": {
    "concept": "method-sets",
    "question": "Speak has a pointer receiver. Calling it on a Dog variable works. Then the same Dog goes into a Speaker interface. What happens?",
    "kind": "choice",
    "choices": [
      "rex says woof\nrex says woof",
      "./main.go:20:18: cannot use d (variable of struct type Dog) as Speaker value in variable declaration: Dog does not implement Speaker (method Speak has pointer receiver)",
      "rex says woof\npanic: runtime error: invalid memory address or nil pointer dereference",
      "./main.go:19:14: cannot call pointer method Speak on Dog"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `8 48`. main (lines 23–29) is locked.",
    "lockedLines": [23, 24, 25, 26, 27, 28, 29]
  },
  "challenge": {
    "prompt": "Fix `Meter` so observations made through the `Metric` interface are kept, every `NewMeter()` is independent, and a zero `Meter` works as a struct field.",
    "entry": "starter.go"
  }
}
---

## Provoke

`Speak` is declared on `*Dog`. Line 19 calls it on a plain `Dog` variable, and line 20 stores that same `Dog` in an interface. One of those lines is fine.

## Decode

### `d.Speak()` is shorthand the compiler writes for you

`d` is a variable. It has an address. When you call a pointer method on an **addressable** value, the compiler quietly rewrites `d.Speak()` to `(&d).Speak()`. That's a convenience at the call site, and nothing more. It doesn't mean `Dog` *has* the method.

What a type *has* is its **method set**:

- The method set of `T` is every method declared with a **value receiver** `(t T)`.
- The method set of `*T` is every method declared with **either** receiver, `(t T)` or `(t *T)`.

Interfaces are checked against method sets, not against what a call site can rewrite. `Dog`'s method set is empty, so `Dog` doesn't implement `Speaker`, and the compiler says so in exactly those words: *method Speak has pointer receiver*.

### Why the rule is shaped like this

When you put a value in an interface, the interface holds **its own copy** of that value. That copy has no address you can reach: nothing names it, so `&` can't be applied to it.

If Go let a pointer method run on that hidden copy, `Speak` would get a pointer to the interface's private copy. Any change it made would land on bytes nobody else can see, and your `d` would stay untouched. Instead of that silent loss, Go refuses at compile time.

The reverse direction is always safe. A `*Dog` in an interface can call a value method: dereference the pointer, copy the `Dog`, call. That's why `*T`'s method set includes `T`'s methods.

The same "no address" rule bites anywhere a value isn't addressable. Map elements can move when the map grows, so they have no stable address, and a composite literal isn't a variable:

```go verified id=not-addressable
package main

import "fmt"

type Rect struct{ W, H float64 }

func (r *Rect) Scale(f float64) { r.W *= f }

func main() {
	m := map[string]Rect{"a": {1, 2}}
	m["a"].Scale(2)
	Rect{1, 2}.Scale(2)
	fmt.Println(m)
}
```

You can count the method sets directly. `Rect` has one method (the value-receiver `Area`), and `*Rect` has two. A value-receiver method still works on a map element, because it only needs a copy:

```go verified id=count-method-sets
package main

import (
	"fmt"
	"reflect"
)

type Rect struct{ W, H float64 }

func (r Rect) Area() float64 { return r.W * r.H }

func (r *Rect) Scale(f float64) {
	r.W *= f
	r.H *= f
}

func main() {
	fmt.Println(reflect.TypeOf(Rect{}).NumMethod(), reflect.TypeOf(&Rect{}).NumMethod())
	m := map[string]Rect{"a": {1, 2}}
	fmt.Println(m["a"].Area())
}
```

### Picking a receiver

- The method **changes** the value, or the struct is big, or it contains something that must not be copied (a `sync.Mutex`): use a **pointer** receiver.
- The method only **reads** a small value: a value receiver is fine, and it keeps the method callable on non-addressable values like map elements.
- If *any* method needs a pointer, the usual convention is to hand out `*T` everywhere, so callers never end up holding a copy.

## Python/JS contrast

- **Python**: `self` is always a reference to the one object. No method ever gets a copy of the instance, so there's nothing like a value receiver. The closest analogy is a method on a frozen `dataclass` that returns a modified copy with `replace()`, except Go's value receiver throws the copy away unless you return it.
- **JavaScript**: `this` is also a reference. Duck typing means any object with a `speak` function "is a Speaker" at runtime, checked only when you call it.
- **False friend:** because `d.Speak()` works, it *looks* like `Dog` has `Speak`. It doesn't. The call site borrowed `d`'s address. An interface can't borrow one, so the interface check fails at compile time instead of at runtime.

## Rebuild

`*Rect` goes into the `Shape` interface, which compiles, because `*Rect`'s method set includes the value methods. But `Scale` runs on a copy of the rectangle, so the areas don't change. `main` is locked, so fix the method.

## Challenge

`Meter` compiles and satisfies `Metric`, yet it forgets everything you observe. The hidden tests use it through `NewMeter()` and the interface, check that two meters don't share state, and use a zero `Meter` as a struct field.

## Stretch

`sync.WaitGroup` and `sync.Mutex` have pointer-receiver methods, and `go vet` has a `copylocks` check. Write a `type SafeCounter struct { mu sync.Mutex; n int }` with a **value** receiver `Inc` and see what `go vet` says locally. Then explain why the compiler lets that through when it refuses the interface assignment in this lesson.
