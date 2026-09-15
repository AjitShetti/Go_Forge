---
{
  "slug": "type-parameters",
  "title": "Type parameters and constraints",
  "concepts": ["generics"],
  "requires": ["generics"],
  "trap": {
    "concept": "generics",
    "question": "Sum accepts T int | float64. Celsius is declared as `type Celsius float64`. The first call passes []float64, the second []Celsius. What happens?",
    "kind": "choice",
    "choices": [
      "3.5\n63.5",
      "./main.go:18:17: Celsius does not satisfy int | float64 (possibly missing ~ for float64 in int | float64)",
      "3.5\npanic: interface conversion: main.Celsius is not float64",
      "./main.go:18:18: cannot use temps (variable of type []Celsius) as []float64 value in argument to Sum"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it compile and print `7 rust 10`. main (lines 8–10) is locked.",
    "lockedLines": [8, 9, 10]
  },
  "challenge": {
    "prompt": "Make `GroupBy` work for any element type and any comparable key, and `SortedKeys` for any map with orderable keys, named types like `CustomerID` included.",
    "entry": "starter.go"
  }
}
---

## Provoke

`Sum` is generic over `T int | float64`. `Celsius` is a new type whose underlying type is `float64`. The first call passes a `[]float64`, and the second passes a `[]Celsius`.

## Decode

### A constraint is a set of types

`[T int | float64]` declares a **type parameter** `T`, and `int | float64` is its **constraint**. A constraint is an interface, read as a *set of types*: `T` may be exactly `int` or exactly `float64`. `Celsius` is neither. It's a distinct named type that merely shares `float64`'s representation, so the call is rejected at compile time, and the compiler suggests the fix.

`~float64` means "any type whose **underlying type** is `float64`": `float64` itself, `Celsius`, and any other named type built on it. Constraints that are meant for "numbers" nearly always want the tilde, and so does the standard library's `cmp.Ordered`.

### What the constraint allows inside the function

The body of a generic function may only do what **every** type in the constraint's set supports:

- `any` means all types. You can assign, pass and store values, but not compare, add or call methods.
- `comparable` is the types that support `==` and `!=`, so it's enough for map keys. It doesn't include `<`.
- `cmp.Ordered` (`~int | ~int8 | ... | ~float64 | ~string`) supports `<` and friends. That's the Rebuild: `>` on a `comparable` `T` isn't allowed, because a struct is comparable but has no order.
- An interface with methods, like `fmt.Stringer`, lets you call those methods.
- You can combine them: a type set plus methods.

```go verified id=type-sets
package main

import (
	"fmt"
	"strconv"
)

type Celsius float64

type Number interface {
	~int | ~int64 | ~float64
}

func Sum[T Number](xs []T) T {
	var total T
	for _, x := range xs {
		total += x
	}
	return total
}

// Labeled is a type set with a method: underlying int, and a Label method.
type Labeled interface {
	~int
	Label() string
}

type Status int

func (s Status) Label() string { return "status-" + strconv.Itoa(int(s)) }

func Describe[T Labeled](v T) string {
	return fmt.Sprintf("%s (%d)", v.Label(), int(v)+1)
}

func main() {
	fmt.Println(Sum([]Celsius{21.5, 19, 23}))
	fmt.Println(Sum[int64]([]int64{1, 2}))
	fmt.Printf("%T\n", Sum([]Celsius{1}))
	fmt.Println(Describe(Status(404)))
}
```

Notice that `Sum` over `[]Celsius` returns a `Celsius`, not a `float64`: `T` keeps the caller's exact type. That's what generics buy over `func Sum(xs []float64)` or `[]any`. Usually `T` is **inferred** from the arguments. `Sum[int64](...)` spells it out.

### How it's compiled

Go doesn't generate a separate copy for every type argument (C++ templates do), and it doesn't box everything behind interfaces (Java does). It uses **GC shape stenciling**: one compiled body per "shape" of memory layout, plus a hidden **dictionary** argument that carries the type-specific details, such as which method to call or how to compare. All pointer types share one shape. The result is usually close to hand-written code, but a method call through a type parameter can be *slower* than a plain interface call, because it goes through the dictionary. The next lesson is about when that trade isn't worth it.

## Python/JS contrast

- **Python**: `def sum_all[T: (int, float)](xs: list[T]) -> T` (3.12 syntax) looks almost identical, but the constraint is only checked by a type checker like mypy. At runtime Python happily sums strings. And a `NewType("Celsius", float)` *does* pass a `float` constraint in mypy, because it's treated as a subtype. Go's named types are not subtypes, so they need `~`.
- **JavaScript / TypeScript**: `function sum<T extends number>(xs: T[])` is checked only at compile time and erased afterwards, and TypeScript's structural types make `type Celsius = number` an alias, not a new type.
- **False friend:** `int | float64` reads like "numbers backed by int or float64". Without `~` it means those two exact types and nothing else.

## Rebuild

`Clamp` uses `cmp.Ordered` and compiles. `Max` uses `comparable` and compares with `>`, which doesn't. `main` is locked.

## Challenge

`GroupBy` and `SortedKeys` are written for strings only, so the hidden tests don't compile against them. The tests group structs by a named string type and ints by a bool, and they sort int, float64 and `CustomerID` keys.

## Stretch

Write `Map[T, U any](xs []T, f func(T) U) []U` and `Filter`, then rewrite a small pipeline with them and with a plain `for` loop. Also look at `iter.Seq[T]` and `slices.Collect`. Which version would you rather debug, and why did the standard library add `slices` and `maps` helpers but not `Map`/`Filter`?
