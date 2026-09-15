---
{
  "slug": "no-implicit-conversion",
  "title": "int + int64 does not compile",
  "concepts": ["conversions", "int-sizing"],
  "requires": [],
  "trap": {
    "concept": "conversions",
    "question": "On a 64-bit machine, int is 64 bits, the same size as int64. What happens?",
    "kind": "choice",
    "choices": [
      "3",
      "./main.go:8:14: invalid operation: a + b (mismatched types int and int64)",
      "3, plus a vet warning about mixing int sizes",
      "./main.go:8:14: cannot use b (variable of type int64) as int value"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it compile and print `area: 10000000000`. Line 10 is locked: the call and its arguments stay.",
    "lockedLines": [10]
  },
  "challenge": {
    "prompt": "Write `MulInt32(a, b)`, which returns the product and true, or 0 and false when the product doesn't fit in an int32. It must never return a wrapped-around number.",
    "entry": "starter.go"
  }
}
---

## Provoke

Two integers, 1 and 2. They're even the same size in memory.

## Decode

### Types are names, not sizes

`int` and `int64` are **different types**, even on a machine where both are 64 bits wide. Go's type checker compares types by identity, not by how many bytes they take. `a + b` requires both operands to have the same type, so it doesn't compile. Nothing is converted automatically: not `int32` to `int64`, not `int` to `float64`, not even a named `type Celsius float64` to `float64`.

The fix is a conversion you write yourself, `int64(a) + b`. That puts every place where a number changes representation somewhere a reader can see it.

### Why so strict? Because conversions change values

A conversion between integer sizes is a **bit operation**, not a mathematical one. Widening (`int32` to `int64`) copies the sign bit into the new high bits, and the value survives. Narrowing (`int64` to `int32`) **throws away the high bits**, with no error and no panic. Overflow in arithmetic is the same: the result wraps around modulo 2ⁿ.

```go verified id=wraparound
package main

import "fmt"

func main() {
	var small int8 = 127
	small++
	big := int64(1) << 40
	x := 300
	fmt.Println(small, int32(big), int32(big+5), uint8(x))
}
```

`127 + 1` in an `int8` is `-128`, because the bit pattern `01111111 + 1` is `10000000`, which reads as -128 in two's complement. `1 << 40` has no bits in the low 32, so `int32` of it is `0`. `300` is `0x12C`, and keeping the low 8 bits leaves `0x2C`, which is `44`.

If Go converted implicitly, every mixed expression would be a place where one of these silent truncations could hide. Making you write `int32(...)` is the language's way of saying "you're choosing to do this".

### Constants get checked, variables don't

Constant expressions are evaluated by the compiler with arbitrary precision, so overflow there is caught at compile time:

```go verified id=constant-overflow
package main

import "fmt"

func main() {
	var b byte = 300
	fmt.Println(b)
}
```

The same `300` in a variable, converted at run time, silently became `44` above. The compiler only knows a value when it's a constant.

### How big is `int`?

`int` and `uint` are the size of a machine word: 64 bits on amd64 and arm64, and 64 bits on WebAssembly too, which is what runs in this app. On 32-bit platforms they're 32 bits. Use `int` for lengths and indexes (that's what `len` returns). Use sized types like `int32` or `int64` when the size is part of a contract, such as a file format, a protocol, or a database column.

```go verified id=int-size
package main

import (
	"fmt"
	"strconv"
	"unsafe"
)

func main() {
	var i int
	var i32 int32
	fmt.Println(strconv.IntSize, unsafe.Sizeof(i), unsafe.Sizeof(i32))
}
```

## Python/JS contrast

- **Python** integers have arbitrary precision: `2**40 * 2**40` is just a bigger number, and nothing ever wraps. Python mixes `int` and `float` implicitly (`1 + 2.5` is `3.5`). The cost is that every int is a heap object, and arithmetic has to check sizes at run time.
- **JavaScript** numbers are all float64. Integers are exact only up to 2⁵³, and past that they silently lose precision instead of wrapping. `BigInt` refuses to mix with `Number` (`1n + 1` is a `TypeError`), which is the one place JS behaves like Go.
- **False friend:** in Go, `int64(a*b)` looks like "compute in 64 bits". It isn't. The multiplication happens in the operands' type *first*, and the conversion only widens a number that has already wrapped. The Rebuild and the Challenge are both about this:

```go verified id=convert-too-late
package main

import "fmt"

func main() {
	var w, h int32 = 100000, 100000
	fmt.Println(int64(w*h), int64(w)*int64(h))
}
```

## Rebuild

`area` takes `int32`s and returns an `int64`. It doesn't compile, and the most obvious fix compiles but prints the wrong area. Get `10000000000`.

## Challenge

Write `MulInt32(a, b)`. The hidden tests sit right on the int32 boundaries: products that just fit, products that just overflow, `MinInt32` exactly, and `MinInt32 * -1`, which is the case the classic "divide it back" check misses.

## Stretch

`len(xs)` returns `int`, but `binary.BigEndian.PutUint32` wants a `uint32`. Write a function that encodes a length prefix for a byte slice, and decide what it should do when the slice is longer than a `uint32` can count. What does a bare `uint32(len(xs))` do on a 5 GB slice?
