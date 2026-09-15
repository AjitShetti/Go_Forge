---
{
  "slug": "values-copy",
  "title": "Every assignment is a copy",
  "concepts": ["value-semantics"],
  "requires": [],
  "trap": {
    "concept": "value-semantics",
    "question": "Three copies, three writes to the copy. Which originals changed?",
    "kind": "choice",
    "choices": ["100 100 100", "1 1 1", "1 1 100", "100 1 100"],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it print `[0 0 0]`. Lines 12 and 14 are locked.",
    "lockedLines": [12, 14]
  },
  "challenge": {
    "prompt": "Write `Clone(grid [][]int)`, which returns a copy that shares no memory with `grid`. The hidden tests write to every element of your copy and then check the original.",
    "entry": "starter.go"
  }
}
---

## Provoke

An array, a struct, and a slice. Each gets copied into a new variable, and the copy gets written to.

## Decode

### Assignment copies the bytes of the value

Go has one rule for `=`, for passing arguments, and for returning values: **copy the value's bytes**. There's no hidden "copy by reference" for big things. What differs between the three is *what the bytes are*.

- `[3]int` is **three ints stored inline**, 24 bytes. `b := a` copies all 24. `b` and `a` are separate arrays, so writing `b[0]` can't touch `a`.
- `Point` is **two ints stored inline**, 16 bytes. Same story.
- `[]int` is a **slice header**: a pointer, a length and a capacity, 24 bytes on a 64-bit machine. `t := s` copies the header, and the pointer inside still points at **the same backing array**. `t[0] = 100` writes through that pointer.

The copy rule is the same for all three. A slice just happens to *contain* a pointer.

```go verified id=sizes
package main

import (
	"fmt"
	"unsafe"
)

type Point struct{ X, Y int }

func main() {
	var arr [3]int
	var big [1000]int
	var p Point
	var s []int
	var str string
	var m map[string]int
	fmt.Println(unsafe.Sizeof(arr), unsafe.Sizeof(big), unsafe.Sizeof(p))
	fmt.Println(unsafe.Sizeof(s), unsafe.Sizeof(str), unsafe.Sizeof(m))
}
```

`Sizeof` counts only the value itself, not what its pointers point at. An array of 1000 ints is 8000 bytes, and all of them get copied when you assign it. A slice of a million ints is still 24 bytes. A `string` is a pointer and a length (16 bytes), and a `map` value is a single pointer to the runtime's hash table.

### Function calls are assignments too

Passing an argument copies it into the parameter. That's why the Rebuild's `reset` zeroes its own copy and returns without the caller noticing:

```go verified id=call-copies
package main

import "fmt"

func setFirst(arr [3]int, s []int) {
	arr[0] = 100
	s[0] = 100
}

func main() {
	arr := [3]int{1, 2, 3}
	s := []int{1, 2, 3}
	setFirst(arr, s)
	fmt.Println(arr, s)
}
```

### Why Go works this way

Values that sit inline can live on the stack or inside other structs with no separate allocation and no pointer to chase, which is good for speed and for the garbage collector. It also makes code predictable: if a function receives a `Point`, it can't change yours. When you *want* sharing, you ask for it by taking a pointer (next lesson) or by using a type that contains one (slices, maps, channels).

## Python/JS contrast

- **Python**: every variable is a reference to an object. `b = a` never copies anything, whether `a` is a list, a dict or an instance. You would have printed `100 100 100`. To copy, you call `copy.copy` or `copy.deepcopy`.
- **JavaScript**: objects and arrays are references, just like Python. Only primitives (`number`, `string`, `boolean`) behave like Go values.
- **False friend:** a Go slice *feels* like a Python list reference, because writes show through. But it's a value holding a pointer, not a reference. Assigning a new slice to `t` or appending past capacity (module M3) doesn't affect `s`. Go structs and arrays are the opposite of Python objects: fully independent copies.

## Rebuild

`reset` zeroes the array it receives, which is a copy. Make `main` see the zeros without touching lines 12 or 14. There's more than one way. Pick one and be ready to say why it works.

## Challenge

Write `Clone` for a `[][]int`. The hidden tests use nil, empty rows, ragged rows, and a row with spare capacity. After cloning, they overwrite every element of your result and check that the original is untouched.

## Stretch

Change the trap so `Point` has a field `Tags []string`. Copy the struct and append to `q.Tags`, then assign `q.Tags[0] = "x"`. Predict what happens to `p.Tags` in each case before you run it, and explain the difference with the slice header.
