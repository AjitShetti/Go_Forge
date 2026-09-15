---
{
  "slug": "wrong-tool",
  "title": "When generics are the wrong tool",
  "concepts": ["generics"],
  "requires": ["generics"],
  "trap": {
    "concept": "generics",
    "question": "Index[T comparable] compiles for []string, and also for []any. The third call searches []any for a []string. What happens? (The runtime's first stderr line counts as output.)",
    "kind": "choice",
    "choices": [
      "1\n1\n2",
      "1\n1\n-1",
      "1\n1\npanic: runtime error: comparing uncomparable type []string",
      "./main.go:18:20: []string does not satisfy comparable"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it compile and print `Bo`. main (lines 8–11) is locked.",
    "lockedLines": [8, 9, 10, 11]
  },
  "challenge": {
    "prompt": "Build a `Router` that dispatches mixed events to handlers by exact type: a generic `Register` gives callers typed handlers, and a non-generic core stores them.",
    "entry": "starter.go"
  }
}
---

## Provoke

`Index` is a textbook generic function over `comparable`. It's called on `[]string`, then on `[]any`. The last call looks for a `[]string` value inside the `[]any`.

## Decode

### `comparable` is a compile-time promise with a runtime escape hatch

Since Go 1.20, **interface types satisfy `comparable`**, because `==` on interface values is legal Go. But comparing two interface values compares their dynamic values, and when both hold the *same* uncomparable type (slices, maps, funcs), the comparison **panics at runtime**. `Index` didn't panic for `42` or `"login"`. Comparing values of different dynamic types is simply `false`. It panicked only when it reached a `[]string` compared with a `[]string`.

So `T comparable` with `T = any` is exactly as safe as the non-generic `func Index(xs []any, v any)`, which is to say not fully. The type parameter added syntax, not safety.

### Signs that generics are the wrong tool

**The function only calls methods.** `func Area[S Shape](s S) float64` does nothing that `func Area(s Shape) float64` doesn't, and the interface version is simpler to read. It also compiles to a direct interface call, while a method call through a type parameter goes through a dictionary (last lesson) and can be slower.

**The body switches on the type.** `switch any(v).(type)` inside a generic function means the code does different things for different types. That's an interface with methods, or separate functions.

**It's generic "to be reusable" but depends on one concrete shape.** The Rebuild's `Oldest[T cmp.Ordered]` can't order a `Person`, because it doesn't know what "older" means. The honest signature is `func Oldest(people []Person) Person`, or `slices.MaxFunc(people, byAge)` when a caller really needs a custom comparison.

**You need a heterogeneous collection.** A `[]T` holds one `T`. Events of five different types in one list is an interface (or `any`) situation, and a type parameter can't help with that.

### Where they fit well

- **Data structures and algorithms that don't care what they hold**: `slices.Sort`, `maps.Keys`, a typed `Cache[K, V]`, a `Set[T]`, channel fan-in helpers.
- **Type-safe edges around a dynamic core.** The Challenge: callers `Register(r, func(e OrderPlaced) string {...})` and get a compile error if the handler's type is wrong, while inside, the router is a `map[reflect.Type]func(any) string`. The generic function does the one thing an interface can't: it carries `E` into the conversion.

Also remember that **methods can't have type parameters**. `func (r *Router) Register[E any]` is a syntax error. That's a deliberate limit. A type assertion like `v.(interface{ Register(func(OrderPlaced) string) })` is checked at run time against the method set, and a generic method would have to be compiled for every possible `E` in advance to be found that way. Generic behavior attached to a value is written as a function taking that value.

## Python/JS contrast

- **Python**: `typing.Generic` and `TypeVar` exist only for type checkers, so there's no runtime cost and no runtime safety. Duck typing already works for "anything with `.area()`", which is why Pythonic code rarely needs generics for behavior. Go's interfaces are the same instinct, and they're checked.
- **JavaScript / TypeScript**: TypeScript encourages generics everywhere, since they're erased and free. Go's generics have a real compilation model, and the idiomatic style is to reach for them last.
- **False friend:** "generic means more reusable and faster". Reusable, sometimes. Faster, not by default, and never simpler.

## Rebuild

`Oldest` was made generic over `cmp.Ordered`, and a `Person` isn't ordered. `main` is locked.

## Challenge

`Router` routes a mixed `[]any` of events to typed handlers. The hidden tests register handlers for two struct types and dispatch a mix. They check unhandled types (including `nil` and a *pointer* to a registered type), and that registering again replaces the handler.

## Stretch

Write `Area[S Shape](s S)` and `AreaI(s Shape)` and benchmark both locally with `go test -bench . -benchmem` on a slice of mixed shapes (hint: the generic version can't even take the mixed slice without `S = Shape`). Then read the "When To Use Generics" post on go.dev/blog, and find one rule in it that this lesson doesn't mention.
