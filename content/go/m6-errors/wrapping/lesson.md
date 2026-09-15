---
{
  "slug": "wrapping",
  "title": "%w, errors.Is, errors.As",
  "concepts": ["error-wrapping"],
  "requires": [],
  "trap": {
    "concept": "error-wrapping",
    "question": "load adds context to ErrNotFound with fmt.Errorf and %v. The message still contains \"not found\". What do errors.Is and errors.Unwrap say?",
    "kind": "choice",
    "choices": [
      "load user 7: not found\ntrue false",
      "load user 7: not found\nfalse true",
      "load user 7: not found\ntrue true",
      "load user 7: not found\nfalse false"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `line 3 in read config app.yaml: bad indent at line 3`. main (lines 8–16) is locked.",
    "lockedLines": [8, 9, 10, 11, 12, 13, 14, 15, 16]
  },
  "challenge": {
    "prompt": "Make `Classify` find `ErrNotFound` and `*RateLimitError` however deeply they're wrapped: by `%w`, by `*OpError`, or by `errors.Join`.",
    "entry": "starter.go"
  }
}
---

## Provoke

`load` adds context to the sentinel from the last lesson, the way every Go codebase does: `fmt.Errorf("load user %d: ...", id, ErrNotFound)`. The verb is `%v`. `main` asks whether the result *is* `ErrNotFound`.

## Decode

### `%v` flattens, `%w` links

`fmt.Errorf` with `%v` formats `ErrNotFound` into text, and the result is a brand-new error holding only a string. The original error value is gone. The words "not found" survive, but `errors.Is` doesn't read words: it compares error values, and none of them is `ErrNotFound` any more.

With `%w`, `fmt.Errorf` returns a `*fmt.wrapError`, which keeps **both** the formatted message and the original error, and has an `Unwrap() error` method that returns the original. That method is the entire mechanism. Every layer that wants to be see-through implements `Unwrap`:

```go verified id=walk-the-chain
package main

import (
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("not found")

func main() {
	inner := fmt.Errorf("query users: %w", ErrNotFound)
	outer := fmt.Errorf("handle GET /users/7: %w", inner)
	fmt.Println(outer)
	for e := error(outer); e != nil; e = errors.Unwrap(e) {
		fmt.Printf("%T: %v\n", e, e)
	}
	joined := errors.Join(errors.New("disk"), ErrNotFound)
	fmt.Println(errors.Is(joined, ErrNotFound), errors.Unwrap(joined) == nil)
}
```

### What `Is` and `As` actually do

- `errors.Is(err, target)`: is `err == target`? If not, does `err` have an `Is(error) bool` method that says yes? If not, call `Unwrap` and repeat.
- `errors.As(err, &ptr)`: can `err` be assigned to `*ptr`'s type? If so, store it and return true. Otherwise, unwrap and repeat. You pass a **pointer to a variable** of the type you want (`var pe *ParseError; errors.As(err, &pe)`), because `As` has to write into it.
- Both also understand `Unwrap() []error`, the multi-error form that `errors.Join` and `fmt.Errorf` with several `%w` verbs produce. They search that tree depth-first. Plain `errors.Unwrap` only knows the single-error form, which is why it returns `nil` for the joined error above.

So in the trap, `errors.Is` compared the `%v` error with `ErrNotFound`, got no match, found no `Unwrap` method, and gave up.

### Wrap or not?

`%w` makes the wrapped error **part of your API**. Callers will start checking for it, and you can't change the underlying error later without breaking them. Wrap errors you intend callers to inspect. Use `%v` when the cause is an implementation detail you don't want to promise. That's a design choice, not a mistake in itself, but it has to be a choice.

## Python/JS contrast

- **Python**: `raise LoadError("load user 7") from e` sets `__cause__`, and the traceback shows the chain. But `except NotFoundError` doesn't look through `__cause__`, so you'd walk the chain by hand. Go's `errors.Is` and `errors.As` are that walk, standardized.
- **JavaScript**: `new Error("load user 7", { cause: err })` links errors the same way, and `instanceof` also only checks the outer one.
- **False friend:** "the message contains the words, so it's the same error". Text is for humans. Identity and type travel only through `%w` and `Unwrap`.

## Rebuild

`readConfig` adds the file name to a `*ParseError`, but `main`'s `errors.As` can't find the line number. `main` is locked.

## Challenge

`Classify` compares with `==` and a type assertion, which only see the outermost error. The hidden tests wrap the sentinel and the typed error in `%w` layers, inside `*OpError`, and inside `errors.Join`. They also check two things that must *not* match: a `%v` wrap, and a different error with the same text.

## Stretch

Give `*RateLimitError` an `Is(target error) bool` method that reports true for a new sentinel `ErrTemporary`, so `errors.Is(err, ErrTemporary)` matches any rate-limit error without callers knowing the type. When is a custom `Is` better than exporting the type, and what does it cost readers of the code?
