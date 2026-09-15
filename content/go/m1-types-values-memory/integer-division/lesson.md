---
{
  "slug": "integer-division",
  "title": "7 / 2 and -7 / 2",
  "concepts": ["integer-division"],
  "requires": [],
  "trap": {
    "concept": "integer-division",
    "question": "What does this print?",
    "kind": "choice",
    "choices": [
      "3\n-3\n-1\n3",
      "3\n-4\n1\n3.5",
      "3.5\n-3.5\n-1\n3.5",
      "3\n-4\n-1\n3"
    ],
    "answer": 0
  },
  "rebuild": {
    "goal": "Make it print `average: 3.5`. Lines 6 and 7 are locked: fix the arithmetic, not the data.",
    "lockedLines": [6, 7]
  },
  "challenge": {
    "prompt": "Implement Python's `//` and `%` in Go: `FloorDiv(a, b)` rounds toward negative infinity, and `FloorMod(a, b)` returns a remainder with the sign of `b`. The starter uses Go's own `/` and `%`, which is exactly what's wrong.",
    "entry": "starter.go"
  }
}
---

## Provoke

Four lines of arithmetic. If you write Python every day, at least two of them will surprise you.

## Decode

### Every line here is integer arithmetic

`7 / 2` has two integer operands, so it's integer division and the answer is `3`. No `3.5` is computed and then thrown away. The machine instruction that runs (`IDIV` on x86, `SDIV` on ARM) produces a whole-number quotient and a remainder, and nothing else.

### Truncation, not floor

When the answer isn't whole, Go **truncates toward zero**. The spec says it outright: `x / y` truncates, and `%` is defined so that `x == (x/y)*y + x%y` always holds.

- `-7 / 2` is `-3.5` truncated toward zero, which is `-3`.
- `-7 % 2` then has to satisfy `-7 == (-3)*2 + r`, so `r = -1`. The remainder takes the sign of the **dividend**.

Go didn't invent this rule. C99 made it standard, and the CPU's divide instruction already works this way, so the compiler can use it directly.

### The float64 line is the nastier one

```go excerpt=trap.go
var avg float64 = 7 / 2
```

Declaring `avg` as `float64` does not make the division floating-point. `7` and `2` are **untyped constants**, and the compiler evaluates `7 / 2` at compile time *before* it looks at where the result goes. Both operands are integer constants, so the result is the integer constant `3`. Only then is `3` converted to `float64` for the assignment. The binary contains the float value `3`, and no division happens at run time.

Make one operand a float constant and the whole constant expression becomes floating-point:

```go verified id=untyped-float
package main

import "fmt"

func main() {
	var a float64 = 7 / 2
	var b float64 = 7 / 2.0
	fmt.Println(a, b)
}
```

With typed variables, the compiler won't quietly convert between int and float. It refuses to compile:

```go verified id=typed-mismatch
package main

import "fmt"

func main() {
	n := 7
	var avg float64 = n / 2
	fmt.Println(avg)
}
```

`n / 2` is an `int` division (the untyped `2` becomes an `int` to match `n`), and an `int` can't be assigned to a `float64`. To get a real average, convert *before* dividing: `float64(n) / 2`.

## Python/JS contrast

The same four expressions in each language:

- `7 / 2`: Go `3`, Python `3.5`, JavaScript `3.5`.
- `-7 / 2`: Go `-3` (truncated), Python `-3.5`, JavaScript `-3.5`.
- Floor division: Python `-7 // 2` is `-4`. Go has no operator for it. In JavaScript, `Math.floor(-7 / 2)` is `-4` and `Math.trunc(-7 / 2)` is `-3`.
- `-7 % 2`: Go `-1`, Python `1`, JavaScript `-1`.

- **Python** has two operators. `/` always returns a float, and `//` floors toward negative infinity. Python's `%` takes the sign of the **divisor** so that `a == (a//b)*b + a%b` holds with *floor* division. Both languages keep that identity true. They just picked different rounding.
- **JavaScript** has no integer type for ordinary numbers: `/` is always float64 division. Its `%` truncates, like Go's.
- **False friend, loudly:** Go's `%` looks like Python's `%` and behaves like JavaScript's. Code like `index % len(xs)` with a negative `index` gives a negative result in Go, and indexing with it panics. Python would have wrapped around.

## Rebuild

The average of 7 and 2 should be 3.5. You may change how it's computed, but not the numbers.

## Challenge

Write `FloorDiv` and `FloorMod` so they match Python's `//` and `%` for every sign combination. Hidden table tests cover positive, negative, and exact divisions. Getting the exact-division case right is what separates a real fix from a lucky one.

## Stretch

Put `math.MinInt64` in a variable `x` and print `x / -1`. The true answer doesn't fit in an `int64`, so what does Go give you, and why doesn't it panic? Find the sentence in the spec that covers this case. Then try the same thing with constants, `math.MinInt64 / -1`, and explain why that version doesn't even compile.
