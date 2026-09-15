---
{
  "slug": "slicing-shares-memory",
  "title": "s[1:3] is a window, not a copy",
  "concepts": ["slice-header", "slicing-shares-array"],
  "requires": [],
  "trap": {
    "concept": "slicing-shares-array",
    "question": "window is nums[1:3]. You write to it, then append to it. What is nums now, and what are window's len and cap?",
    "kind": "choice",
    "choices": [
      "[1 2 3 4 5]\n3 4",
      "[1 20 3 40 5]\n3 4",
      "[1 20 3 4 5]\n3 3",
      "[1 20 3 4 5]\n3 4"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `[1 2 3 4] [1 2 99]`. main (lines 10–13) is locked.",
    "lockedLines": [10, 11, 12, 13]
  },
  "challenge": {
    "prompt": "Write `Chunk(xs, size)`, which splits a slice into pieces that share no memory with xs or with each other.",
    "entry": "starter.go"
  }
}
---

## Provoke

Take a two-element window into the middle of a slice. Write through it, then append to it.

## Decode

### Slicing makes a new header, not a new array

`nums[1:3]` doesn't copy anything. It builds a new **slice header** that points into the **same backing array**:

- **pointer**: the address of `nums[1]`
- **len**: `3 - 1 = 2`, so `window` is `[2 3]`
- **cap**: from index 1 **to the end of `nums`'s array**, `5 - 1 = 4`

```
backing array:  [ 1 | 2 | 3 | 4 | 5 ]
nums:             ptr->1, len 5, cap 5
window:               ptr->2, len 2, cap 4
                      |<- len ->|
                      |<---- cap ------>|
```

So `window[0] = 20` writes into `nums[1]`. That's the first surprise.

### Capacity is the second surprise

A window's capacity doesn't stop at its length. It runs to the end of the underlying array. `append(window, 40)` checks `len + 1 <= cap`, and `3 <= 4` is true, so it writes 40 into the next slot of **the same array**: `nums[3]`. `nums` never asked to change and never got a say.

That's the same mechanism as the slice-aliasing lesson. Here the spare capacity comes from slicing instead of from `make`.

### The three-index slice caps capacity

`s[low:high:max]` sets capacity to `max - low`. With `cap == len`, the next `append` has no room, so it has to allocate a new array and copy the window into it:

```go verified id=three-index
package main

import "fmt"

func main() {
	nums := []int{1, 2, 3, 4, 5}
	window := nums[1:3:3]
	fmt.Println(len(window), cap(window))
	window = append(window, 40)
	window[0] = 20
	fmt.Println(nums, window)
}
```

After that `append`, `window` has its own array, so `window[0] = 20` no longer reaches `nums`. Before the append, it would have. Capping capacity only protects against appends. It doesn't make a copy. For full independence, copy: `slices.Clone(nums[1:3])`, or `make` plus `copy`.

### Windows keep the whole array alive

The GC can't free part of an array. A 3-byte slice taken from a 100 MB buffer keeps all 100 MB alive for as long as the small slice exists. If you keep a small piece of a big read for a long time, copy it out.

## Python/JS contrast

- **Python**: `nums[1:3]` **copies** into a new list. Writing to it never affects `nums`, and appending never does either. The only exception is NumPy arrays, where slices are *views*, which is exactly Go's behavior.
- **JavaScript**: `arr.slice(1, 3)` copies too. `TypedArray.prototype.subarray` is the view version, and it's the closest JS gets to a Go slice.
- **False friend:** `s[a:b]` is the same syntax as Python's copy, with the opposite meaning. In Go, slicing is O(1) because nothing is copied. That's the whole reason it's fast, and it's the whole reason for this bug.

## Rebuild

`firstTwo` returns a window. The caller appends to it and overwrites `all[2]`. `main` is locked, so fix `firstTwo`. One character-level change is enough, and a copy works too.

## Challenge

Write `Chunk(xs, size)`. The hidden tests check the values (even split, a shorter last chunk, size larger than the input, empty input). Then they write to the chunks and append to the chunks, and require that `xs` and the neighboring chunk are untouched.

## Stretch

Do the pieces returned by `bytes.Split` share memory with its input? Predict, then prove it: split a `[]byte`, write to one piece, and print the original. If they do share, what happens when you `append` to the first piece? Then explain what the GC can and can't free if you keep one small piece of a 100 MB buffer in a global.
