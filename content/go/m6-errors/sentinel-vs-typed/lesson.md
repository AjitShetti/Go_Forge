---
{
  "slug": "sentinel-vs-typed",
  "title": "Sentinel and typed errors",
  "concepts": ["error-values"],
  "requires": [],
  "trap": {
    "concept": "error-values",
    "question": "ErrNotFound is errors.New(\"not found\"). lookup returns errors.New(\"not found\") too. Same text. What does it print?",
    "kind": "choice",
    "choices": [
      "not found\ntrue true",
      "not found\nfalse true",
      "not found\nfalse false",
      "not found\ntrue false"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `ok 20` and then `declined: insufficient funds`. main (lines 8–21) is locked.",
    "lockedLines": [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
  },
  "challenge": {
    "prompt": "Write `ParsePort(s)`: return the `ErrEmpty` sentinel for \"\", a `*SyntaxError` for non-numbers, and a `*RangeError` for numbers outside 1–65535.",
    "entry": "starter.go"
  }
}
---

## Provoke

The package declares a sentinel error, `ErrNotFound`. `lookup` returns an error with exactly the same message. `main` compares the errors, and then their texts.

## Decode

### `errors.New` returns a fresh pointer

The whole `errors.New` function is essentially:

```
type errorString struct{ s string }

func (e *errorString) Error() string { return e.s }

func New(text string) error { return &errorString{text} }
```

Every call allocates a new `errorString` and returns its **address**, wrapped in the `error` interface. Comparing two interface values with `==` compares their type words and then their data. Both hold `*errors.errorString`, but the data is two different pointers, so `==` is `false`. The text is identical, and text isn't what `==` looks at.

That's deliberate. If `errors.New` returned a struct *value*, two errors with the same text would compare equal, and `io.EOF` would be indistinguishable from some other package's `errors.New("EOF")`. Returning a pointer gives every sentinel an identity:

```go verified id=pointer-identity
package main

import (
	"errors"
	"fmt"
)

type valueErr struct{ msg string }

func (e valueErr) Error() string { return e.msg }

func main() {
	a, b := errors.New("eof"), errors.New("eof")
	var c, d error = valueErr{"eof"}, valueErr{"eof"}
	fmt.Println(a == b, c == d)
	fmt.Printf("%T %T\n", a, c)
}
```

### Two ways to say what went wrong

**A sentinel error** is a package-level variable you compare against: `io.EOF`, `sql.ErrNoRows`, `fs.ErrNotExist`. It works when the caller only needs to know *which* condition happened. It only works if the code **returns that exact variable**. A new error with the same text is a different error, which is what the trap shows.

**A typed error** is your own type implementing `error`, used when the caller needs **data**: which value was out of range, which file, which field. The caller gets at it with a type assertion (or `errors.As`, next lesson):

```go excerpt=challenge/solution.go
type RangeError struct {
Value int
}
return 0, &RangeError{Value: n}
```

A caller then writes `if re, ok := err.(*RangeError); ok { ... re.Value ... }`.

Rules of thumb:

- Never make callers compare `err.Error()` strings. The message is for humans, and it can change.
- Export a sentinel or a type **only if callers need to react** to that case. Everything else can be a plain `fmt.Errorf`.
- Use pointer receivers on typed errors, and return `&T{...}`. That keeps assertions to `*T` consistent and avoids the typed-nil trap from M5.

## Python/JS contrast

- **Python**: exceptions are classes, and `except NotFoundError as e:` matches by type, with data in attributes. That's Go's typed errors. Python has no common "sentinel" idiom, because an exception instance is raised, not compared. The false friend is comparing `str(e)`, which people do in Python too, and which is fragile in both languages.
- **JavaScript**: `err instanceof NotFoundError` is the typed-error check. `err.message === "not found"` is the string comparison Go discourages.
- **False friend:** `err == ErrNotFound` looks like a value comparison. For `errors.New` sentinels, it's an identity comparison.

## Rebuild

`main` checks for `ErrInsufficientFunds` with `==`, but `Withdraw` builds a new error with the same message. `main` is locked.

## Challenge

The hidden tests call `ParsePort` with valid ports, `""`, out-of-range numbers (including `0` and `-1`), and inputs that aren't numbers at all. They check the sentinel with `==`, the typed errors with type assertions, the fields, and the messages.

## Stretch

`os.Open` on a missing file returns a `*fs.PathError`, yet `errors.Is(err, fs.ErrNotExist)` is true. Print `%#v` of that error. How can one error be a typed error and also match a sentinel? (The next lesson answers this; try to work it out first.)
