---
{
  "slug": "embedding",
  "title": "Embedding is not inheritance",
  "concepts": ["embedding"],
  "requires": [],
  "trap": {
    "concept": "embedding",
    "question": "AuditLogger embeds Logger and declares its own Log. Logger.Info calls Log. What does a.Info print?",
    "kind": "choice",
    "choices": [
      "[audit] started\n[audit] INFO ready",
      "[audit] started\napp: INFO ready",
      "app: started\napp: INFO ready",
      "[audit] started\n[audit] app: INFO ready"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `admin ana` and then `hello, admin ana`. main (lines 25–29) is locked.",
    "lockedLines": [25, 26, 27, 28, 29]
  },
  "challenge": {
    "prompt": "Make `CountingCache` count every lookup, through `Get` and through `GetOr`, as a hit or a miss, while `Set` still passes through to the wrapped cache.",
    "entry": "starter.go"
  }
}
---

## Provoke

`AuditLogger` embeds a `Logger` and declares its own `Log`, the classic "override". `Info` exists only on `Logger`, and it calls `Log`. Both lines go through `a`.

## Decode

### An embedded type is a field, with a shortcut

`type AuditLogger struct { Logger }` declares a field. Its type is `Logger`, and its name is also `Logger`. You can write `a.Logger` and get it.

The shortcut is **promotion**: when `a.Info` doesn't name anything declared on `AuditLogger`, the compiler looks one level down, finds `Logger.Info`, and rewrites the selector to `a.Logger.Info`. This happens while compiling. At runtime there's no lookup, just an ordinary call on the inner field.

So `a.Info("ready")` is `a.Logger.Info("ready")`. Inside `Info`, the receiver `l` is a `Logger`: the field's value, not the `AuditLogger` around it. `l.Log` can only mean `Logger.Log`. The inner value has no pointer back to the struct that contains it, and there's no table of "which `Log` does my outer type prefer". **Struct method calls are resolved statically.**

`a.Log("started")` finds `Log` declared directly on `AuditLogger`, so no promotion happens. The outer `Log` shadows the inner one only for selectors written on the *outer* type.

### Where dynamic dispatch actually lives

Go has exactly one mechanism that picks a method at runtime: calling through an **interface** value (next module). If `Logger` needs a replaceable `Log`, give it a field of an interface type and call that. Embedding alone never does it.

### Promotion rules, verified

Promotion works for interface satisfaction too: promoted methods are in the outer type's method set. The shallower name wins, so `p.ID` is `Product.ID`, while `p.Base.ID` is still there:

```go verified id=promotion-and-shadowing
package main

import "fmt"

type Named interface {
	Name() string
}

type Base struct {
	ID   int
	name string
}

func (b Base) Name() string { return b.name }

type Product struct {
	Base
	ID string
}

func main() {
	p := Product{Base: Base{ID: 7, name: "pen"}, ID: "SKU-7"}
	var n Named = p
	fmt.Println(n.Name(), p.ID, p.Base.ID)
	fmt.Printf("%+v\n", p)
}
```

Two embedded types with the same method at the same depth don't make one the "parent". The name is ambiguous, and it's a compile error only if you use it:

```go verified id=ambiguous
package main

import "fmt"

type Reader struct{}

func (Reader) Close() error { return nil }

type Writer struct{}

func (Writer) Close() error { return nil }

type File struct {
	Reader
	Writer
}

func main() {
	var f File
	fmt.Println(f.Close())
}
```

## Python/JS contrast

- **Python**: `class AuditLogger(Logger)` makes `self` inside `Logger.info` the `AuditLogger` instance, and `self.log` looks up the method at call time on the actual object's class (the MRO). Overriding changes behavior deep inside inherited methods. That's exactly what Go's embedding doesn't do.
- **JavaScript**: `class AuditLogger extends Logger` behaves the same way: `this.log()` inside an inherited method dispatches through the prototype chain to the subclass.
- **False friend:** embedding *looks* like inheritance (methods show up on the outer type). It's composition with automatic forwarding. The inner value never learns it's inside something.

## Rebuild

`Admin` embeds `User` and "overrides" `Name`. `a.Name()` is right, but `Greeting` is promoted from `User`, so it calls `User.Name`. `main` is locked.

## Challenge

`CountingCache` embeds a `Cache` and must count lookups. The hidden tests wrap a map-backed cache whose `GetOr` calls its own `Get`, and they check counts through `Get`, through `GetOr`, and through the `Cache` interface.

## Stretch

Embed a `*bytes.Buffer` (a pointer) in a struct, leave it nil, and call `Write` through the outer struct. Explain the panic you get, and why embedding an interface type (as `CountingCache` does) fails the same way when the field is left unset.
