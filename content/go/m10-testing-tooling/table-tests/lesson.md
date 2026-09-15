---
{
  "slug": "table-tests",
  "title": "Table-driven tests and subtests",
  "concepts": ["table-tests"],
  "requires": [],
  "trap": {
    "concept": "table-tests",
    "question": "A table test for fields: \"a,b\" should give [a b], and \"\" should give an empty slice. fields returns nil for \"\". The loop compares with reflect.DeepEqual. What's printed?",
    "kind": "choice",
    "choices": [
      "ok   fields(\"a,b\")\nok   fields(\"\")",
      "ok   fields(\"a,b\")\nFAIL fields(\"\") = [], want []",
      "ok   fields(\"a,b\")\nFAIL fields(\"\") = <nil>, want []",
      "FAIL fields(\"a,b\") = [a b], want [a b]\nFAIL fields(\"\") = [], want []"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make all three lines start with `ok`. main (lines 9–21) is locked.",
    "lockedLines": [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
  },
  "challenge": {
    "prompt": "Write `Explain(got, want)`: \"\" when two string slices match (nil equals empty), otherwise a message naming the length mismatch or the first differing element, quoted with %q.",
    "entry": "starter.go"
  }
}
---

## Provoke

The shape of almost every Go test: a slice of cases, a loop, a comparison, a message. `fields("")` returns `nil`, and the table expects `[]string{}`. The check is `reflect.DeepEqual`, and the message prints with `%v`.

## Decode

### "Deeply equal" is stricter than "means the same"

`reflect.DeepEqual` walks both values recursively, and for slices it requires both to be nil **or** both to be non-nil before it compares the elements. A nil slice (no backing array, as in M3) and an empty non-nil slice hold the same zero elements, yet `DeepEqual` reports them different.

Then `%v` hides the difference: both print as `[]`. The test fails with a message that says `got [], want []`, the most confusing failure a test can produce.

```go verified id=nil-vs-empty
package main

import (
	"fmt"
	"reflect"
	"slices"
)

func main() {
	var nilSlice []string
	empty := []string{}
	fmt.Println(reflect.DeepEqual(nilSlice, empty), slices.Equal(nilSlice, empty))
	fmt.Printf("%v %v\n", nilSlice, empty)
	fmt.Printf("%#v %#v\n", nilSlice, empty)
	fmt.Printf("%q %q\n", []string{"b "}, []string{"b"})
}
```

Pick the comparison that matches what your function promises:

- `==` for comparable values (numbers, strings, structs of those).
- `slices.Equal` and `maps.Equal` when nil and empty mean the same thing, which is almost always.
- `reflect.DeepEqual` when you really mean identical structure, including nil versus empty.
- `github.com/google/go-cmp/cmp.Diff` for big nested values: it prints a readable diff, and its options can treat nil and empty as equal.

Print failures with **`%q`** for strings and `%#v` for structures, so whitespace, empty strings and nil versus empty are visible.

### What `t.Run` adds to a table

In a real test file, the loop body goes inside `t.Run(c.name, func(t *testing.T) { ... })`:

- Each case is a named **subtest** (`TestFields/empty_input`) that passes or fails on its own, shows up in `go test -v`, and can be run alone with `go test -run 'TestFields/empty'`.
- `t.Fatal` stops **only that subtest**. Without `t.Run`, one `t.Fatal` in the loop ends the whole test, and the remaining cases never report. (`t.Fatal` calls `runtime.Goexit`: deferred calls run, and the goroutine running the test function stops.)
- `t.Helper()` inside a comparison helper makes failures report the caller's line, not the helper's.
- `t.Parallel()` inside the subtest runs the cases concurrently, after the parent loop has finished registering them all. Since Go 1.22 the loop variable is per-iteration (M7), so capturing `c` is safe.
- `t.Cleanup(f)` registers teardown that runs after the subtest *and all of its own subtests* finish.

The Challenge's hidden tests are a table like this, and their failure messages use `%q`.

## Python/JS contrast

- **Python**: `pytest.mark.parametrize` is the table, and each parameter set becomes a separate test ID, like `t.Run`. `assert [] == None` fails loudly with both values shown, and there's no nil-slice concept, so this exact trap doesn't exist. The general lesson, a message that makes two different values look identical, does.
- **JavaScript**: Jest's `test.each` is the table. `toEqual` treats `undefined` properties as missing, and `toStrictEqual` doesn't: the same "which equality did I mean" choice.
- **False friend:** "`reflect.DeepEqual` is the general-purpose equality for tests". It's the *strictest* one, and in Go the strict one is often not what your function promises.

## Rebuild

The table in `main` is locked. `check` decides what "matches" means and how a failure reads. Make it compare what `fields` promises and print failures you could actually debug.

## Challenge

`Explain` is the comparison helper for a table test. The hidden tests are themselves a table: equal slices, nil against empty, a trailing space, an empty-string element, several differences at once, and different lengths.

## Stretch

Write a real `fields_test.go` locally with `t.Run` subtests, one of which calls `t.Fatal`. Run `go test -v`, then `go test -run 'TestFields/empty'`, then `go test -json | head`. Then make every subtest call `t.Parallel()` and add a `t.Cleanup` in the parent: in what order do the cleanups and the parallel subtests actually run?
