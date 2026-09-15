---
{
  "slug": "nil-interface",
  "title": "A nil pointer in an interface is not nil",
  "concepts": ["interface-type-value-pair"],
  "requires": [],
  "trap": {
    "concept": "interface-type-value-pair",
    "question": "find(\"present\") never creates a NotFoundError: err stays a nil pointer, and find returns it as an error. What does main print?",
    "kind": "choice",
    "choices": [
      "ok",
      "failed: <nil>",
      "failed: not found: present",
      "panic: runtime error: invalid memory address or nil pointer dereference"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `30 ok` and then `-1 error: invalid age`. main (lines 5–13) is locked.",
    "lockedLines": [5, 6, 7, 8, 9, 10, 11, 12, 13]
  },
  "challenge": {
    "prompt": "Fix `Validate` so a valid user gets a nil `error`, and an invalid one gets `ValidationErrors` listing every problem.",
    "entry": "starter.go"
  }
}
---

## Provoke

Inside `find`, `err` is a `*NotFoundError` that's never assigned, so it's nil. `find` returns it as an `error`, and `main` checks `err != nil` the way every Go program does.

## Decode

### An interface value is two words

A variable of interface type, like `error`, holds a **pair**:

- a **type word**: which concrete type is stored (here, a pointer to the runtime's description of `*NotFoundError`)
- a **data word**: the value itself, or a pointer to it

An interface is `nil` only when **both** words are empty: no type, and no value.

`return err` converts a `*NotFoundError` to `error`. The conversion fills in the type word, `*NotFoundError`, and copies the pointer into the data word. That pointer happens to be nil, but the type word isn't empty any more, so the interface isn't nil. `err != nil` compares the whole pair against the all-empty pair and reports `true`.

```go verified id=two-words
package main

import (
	"fmt"
	"unsafe"
)

type NotFoundError struct {
	Key string
}

func (e *NotFoundError) Error() string {
	return "not found: " + e.Key
}

func main() {
	var p *NotFoundError
	var err error = p
	fmt.Println(err == nil, p == nil, unsafe.Sizeof(err))
	fmt.Printf("%T\n", err)
	fmt.Println(err == (*NotFoundError)(nil))
}
```

`unsafe.Sizeof(err)` is 16 on a 64-bit machine: two 8-byte words. `%T` shows the type word is set. Comparing against a nil `*NotFoundError` converted to `error` matches, because then both pairs hold the same type and a nil pointer.

### Why it printed `<nil>` instead of crashing

The branch ran `fmt.Println("failed:", err)`, and `fmt` calls `err.Error()`. That method dereferences `e.Key` through a nil pointer, which panics. Call it yourself and you get the real panic:

```go verified id=nil-receiver-panic
package main

import "fmt"

type NotFoundError struct {
	Key string
}

func (e *NotFoundError) Error() string {
	return "not found: " + e.Key
}

func main() {
	var p *NotFoundError
	var err error = p
	fmt.Println("calling Error")
	fmt.Println(err.Error())
}
```

`fmt` protects itself. It recovers the panic, sees that the receiver was a nil pointer, and prints `<nil>`. That's why the trap printed `failed: <nil>` instead of crashing. In real code, this is the log line that reads `error: <nil>` while a request fails for no visible reason.

### The rule that keeps you out of this

**Return the literal `nil` for "no error".** Never return a variable of a concrete pointer (or slice, or map) type through an `error` result, because a nil value of that type still fills the type word. If a helper returns `*ValidationError`, check it before converting:

```go excerpt=rebuild/solution.go
if err := validateAge(age); err != nil {
return err
}
return nil
```

Inside the `if`, `err` is still a `*ValidationError`, and the conversion to `error` only happens once you know it's non-nil.

## Python/JS contrast

- **Python**: there's one `None`, and it has no type besides `NoneType`. `x is None` is true or false with no "typed None" in between. Go's interface nil is closer to a pair `(type, value)` where only `(None, None)` counts as nil.
- **JavaScript**: `null` and `undefined` don't carry the type of the variable they came from either, so `err === null` means what it says.
- **False friend:** `if err != nil` reads like "if something went wrong". It actually asks whether the interface pair is empty, which is a different question once a typed nil sneaks in.

## Rebuild

`validateAge` returns `*ValidationError`, and `check` passes that straight through as an `error`. The valid age comes out as an error. `main` is locked.

## Challenge

`Validate` collects problems into a `ValidationErrors` slice and returns it. The hidden tests check that a valid user gets a nil `error` (and print the dynamic type if it isn't), that boundary ages are fine, and that invalid users get every problem, in order.

## Stretch

`reflect.ValueOf(err).IsNil()` can detect a typed nil inside an interface. Write a `isNilError(err error) bool` with it, then find a type for which `IsNil` panics (hint: a struct type implementing `error`). Explain why "return the literal nil" beats any runtime check.
