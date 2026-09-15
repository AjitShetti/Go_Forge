---
{
  "slug": "map-order",
  "title": "Map order is random on purpose",
  "concepts": ["map-iteration-order"],
  "requires": [],
  "trap": {
    "concept": "map-iteration-order",
    "question": "Print the map, then range over the same unchanged map 50 times and check whether the key order ever differs. What does it print?",
    "kind": "choice",
    "choices": [
      "map[a:1 b:2 c:3 d:4 e:5]\nsame order every time: true",
      "map[a:1 b:2 c:3 d:4 e:5]\nsame order every time: false",
      "map[c:3 a:1 e:5 b:2 d:4]\nsame order every time: false",
      "map[c:3 a:1 e:5 b:2 d:4]\nsame order every time: true"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Print the scoreboard highest score first: `bo 50`, `cy 40`, `ana 30`. Line 9 (the data) is locked.",
    "lockedLines": [9]
  },
  "challenge": {
    "prompt": "Write `TopN(scores, n)`, which returns the n best players, highest first, with ties broken by name. It has to give the same answer on every call.",
    "entry": "starter.go"
  }
}
---

## Provoke

Five keys inserted in alphabetical order. The map is printed once, then walked 50 times without being changed.

## Decode

### The runtime shuffles the starting point, deliberately

A Go map is a hash table: keys go into slots chosen by their hash, not by when they were inserted, so there's no insertion order to give back. You might still expect *some* stable order, since the same table walked twice should come out the same way.

It doesn't, because the runtime **picks a random starting point for every `range`**. Each loop begins at a random slot (and a random offset within it) and wraps around. The Go 1 release notes put it plainly: iteration order is "unpredictable, even if the same loop is run multiple times with the same map."

Go does this on purpose. Before Go 1, iteration order was merely *unspecified*, and it was usually stable in practice, so programs quietly came to depend on it. Those programs then broke when the map implementation changed, or on another architecture. Randomizing on every loop makes that dependency fail in your tests today, instead of in production after an upgrade. Every map also gets its own random hash seed, which makes it hard for an attacker to pick keys that collide.

### `fmt` sorts maps for you, which hides this

Since Go 1.12, `fmt` prints maps **with their keys sorted**, precisely so that output is reproducible in tests and logs. `fmt.Println(m)` shows `map[a:1 b:2 ...]`, and it looks ordered. The `range` loop underneath it isn't.

Here's the raw order of one loop. The content pipeline ran it several times and recorded it as a sorted set of lines, because the order changes between runs:

```go verified id=raw-range nondeterministic=sorted-lines
package main

import "fmt"

func main() {
	m := map[string]int{"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}
	for k, v := range m {
		fmt.Println(k, v)
	}
}
```

### Getting a stable order: sort the keys

When order matters, it's your job to impose it. Collect the keys, sort them, and loop over the sorted slice:

```go verified id=sorted-keys
package main

import (
	"fmt"
	"maps"
	"slices"
)

func main() {
	m := map[string]int{"cy": 3, "ana": 1, "bo": 2}
	for _, k := range slices.Sorted(maps.Keys(m)) {
		fmt.Println(k, m[k])
	}
}
```

## Python/JS contrast

- **Python**: since 3.7, `dict` is guaranteed to keep **insertion order**. CPython implements it with a compact array of entries plus a separate hash index. Code that relies on dict order is correct Python, and the same logic ported to a Go map is a bug.
- **JavaScript**: `Map` iterates in insertion order. Plain objects mostly do too, except that integer-like keys come first in ascending order.
- **False friend:** a Go map behaves like a Python dict for lookups, and `fmt` even prints it sorted. It has no order at all. If you need insertion order in Go, keep a slice of keys next to the map.

## Rebuild

The scoreboard comes out sorted by name, because `sort.Strings` sorts names. Keep collecting the names, but order them by score, highest first. The data line is locked.

## Challenge

Write `TopN(scores, n)`. The hidden tests call it 20 times per case, because a result that depends on map order will eventually come out different. They also cover ties, `n` larger than the map, `n = 0`, and a nil map.

## Stretch

`sort.Slice` isn't stable, and `slices.SortStableFunc` is. Build a map with 6 players and 3 tied scores, and show that sorting by score alone gives different tie orders across runs even with the stable sort. Explain why stability doesn't help when the input comes from a map.
