---
{
  "slug": "nil-maps",
  "title": "Reading a nil map is fine, writing panics",
  "concepts": ["nil-map"],
  "requires": [],
  "trap": {
    "concept": "nil-map",
    "question": "A map that was declared but never made. Read, len, compare, delete, then increment. What happens? (The runtime's first stderr line counts as output.)",
    "kind": "choice",
    "choices": [
      "0 0 true\ndone",
      "0 0 true\npanic: assignment to entry in nil map",
      "panic: assignment to entry in nil map",
      "panic: runtime error: invalid memory address or nil pointer dereference"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `2 1`. main (lines 10–14) is locked.",
    "lockedLines": [10, 11, 12, 13, 14]
  },
  "challenge": {
    "prompt": "Make `Index` work as a zero value: `var ix Index; ix.Add(\"go\", 1)` must not panic and must be remembered.",
    "entry": "starter.go"
  }
}
---

## Provoke

`counts` is declared and never created with `make`. Four operations work. Then one doesn't.

## Decode

### A map variable is a pointer to the runtime's table

A `map[string]int` value is **one pointer** to a hash table the runtime manages. `var counts map[string]int` leaves that pointer nil: there's no table at all.

The runtime's map functions check for nil **on purpose**, for every operation that can be answered without a table:

- **read** `counts["go"]`: no table, so no entry, so return the zero value `0`.
- `len(counts)`: `0`.
- `range counts`: zero iterations.
- `delete(counts, "go")`: nothing to delete, so it's a no-op.

A **write** can't be answered that way. It needs memory to store the entry, and the runtime can't create the table *for* you. It would have to write the new table's pointer into your variable, but the map operation only received a **copy** of that pointer, just like any other argument. There's nowhere to put it, so the runtime panics with a message that names exactly this case.

### Why a nil slice doesn't have this problem

`append` on a nil slice works because `append` **returns** the new header and you assign it: `s = append(s, x)`. There's no `m = set(m, k, v)` for maps, because a map write is a statement, not an expression that hands back a new map. So a nil map would need an allocation somewhere the syntax doesn't allow.

```go verified id=nil-slice-vs-nil-map
package main

import "fmt"

func main() {
	var s []int
	s = append(s, 1)

	var m map[string]int
	v, ok := m["x"]
	fmt.Println(s, v, ok, len(m), m == nil)
}
```

### Passing a map shares the table, replacing it doesn't

Because a map value is a pointer, a function that *writes entries* changes the caller's map. A function that *assigns a new map* to its parameter changes only its own copy:

```go verified id=map-is-a-pointer
package main

import (
	"fmt"
	"unsafe"
)

func fill(m map[string]int) {
	m["a"] = 1
}

func replace(m map[string]int) {
	m = map[string]int{"b": 2}
	m["c"] = 3
}

func main() {
	m := map[string]int{}
	fill(m)
	replace(m)
	fmt.Println(m, unsafe.Sizeof(m))
}
```

That's why lazy creation belongs in a **pointer-receiver** method, which can store the new map into the struct the caller owns. The Rebuild and the Challenge both come down to that.

## Python/JS contrast

- **Python**: there's no nil dict. A missing dict is `None`, and `None["go"]` raises `TypeError` even on a *read*. A missing key raises `KeyError` unless you use `.get()` or `defaultdict`. Go makes reads from both a nil map and a missing key quietly return zero, and saves the failure for nil *writes*.
- **JavaScript**: `undefined["go"]` throws on read as well. An object or `Map` has to exist before you touch it.
- **False friend:** a nil map looks as usable as a nil slice. Both have `len` 0, and both can be ranged over and read from. Only the slice lets you add to it without `make` first.

## Rebuild

A struct with a map field, used as a zero value. `main` is locked, so make the method safe.

## Challenge

Make `Index` usable as a zero value. The hidden tests call `Lines` on an empty index, `Add` on a zero `Index` variable and on a struct field, and check that every word is kept.

## Stretch

`sync.Map` and `map` with a `sync.Mutex` are both usable as zero values. Look at how `net/http`'s `Header` type is declared (`type Header map[string][]string`) and explain why `var h http.Header; h.Set("a", "b")` panics, while the same call on a `*Index`-style struct wrapper wouldn't have to.
