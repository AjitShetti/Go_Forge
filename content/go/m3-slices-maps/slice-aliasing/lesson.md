---
{
  "slug": "slice-aliasing",
  "title": "Two appends, one backing array",
  "concepts": ["slice-header", "append-aliasing"],
  "requires": [],
  "trap": {
    "concept": "append-aliasing",
    "question": "What does this print?",
    "kind": "choice",
    "choices": ["99 42", "42 42", "99 99", "panic: runtime error: index out of range [3] with length 3"],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print 99 42. Lines 7, 8 and 9 must stay exactly as they are.",
    "lockedLines": [7, 8, 9]
  },
  "challenge": {
    "entry": "starter.go"
  }
}
---

## Provoke

`a` has three elements. You append to it twice, with two different values, and keep both results. Python would give you two independent lists here.

## Decode

A slice isn't the array. It's a small struct with three fields: a **pointer** to the first element of a backing array, a **length**, and a **capacity** (how many elements exist in that array from the pointer onward). When you pass a slice around or assign it, you copy these three words, not the elements.

```diagram name=slice-aliasing
```

`make([]int, 3, 4)` allocates an array with room for four ints and gives you a header saying "length 3, capacity 4". Slot 3 exists in memory. You just can't index it through `a`, because `a`'s length is 3.

`append(a, 99)` does roughly this:

1. Is `len(a) + 1 <= cap(a)`? Here it's 4 ≤ 4, yes.
2. Then write 99 into slot 3 **of the same backing array** and return a new header: same pointer, length 4, capacity 4.
3. Only if there were no room would it allocate a bigger array, copy the elements over, and return a header pointing at the new array.

So `b` is "same array, length 4". Then `append(a, 42)` asks the same question about `a`. `a` still says length 3, capacity 4, so there's room, and it writes 42 into **the same slot 3**. `c` is "same array, length 4" too. `b[3]` and `c[3]` are one memory cell, and the last write wins.

You can check that they share memory instead of taking my word for it:

```go verified id=same-array
package main

import "fmt"

func main() {
	a := make([]int, 3, 4)
	b := append(a, 99)
	c := append(a, 42)
	fmt.Println(&a[0] == &b[0], &b[0] == &c[0])
	fmt.Println(len(a), cap(a), len(b), cap(b))
}
```

Why is Go built this way? `append` has to be cheap in loops. If every append copied the whole slice, building a slice of n elements would cost O(n²). Reusing spare capacity makes appends amortized O(1). The price is that a spare slot belongs to *whoever appends into it first*, and Go doesn't track who that is.

This bug shows up in real code as "I appended to a slice I got from a function, and some other slice changed." It happens whenever two slices share a backing array that still has spare capacity.

The fix, if you need an independent slice, is to make the spare capacity disappear. Then the next `append` has no choice but to allocate. The three-index slice `s[low:high:max]` sets capacity explicitly:

```go verified id=full-slice-expression
package main

import "fmt"

func main() {
	a := make([]int, 3, 4)
	b := append(a[:3:3], 99)
	c := append(a[:3:3], 42)
	fmt.Println(b[3], c[3], &a[0] == &b[0])
}
```

`a[:3:3]` has capacity 3, so each `append` allocates its own new array, and neither write touches `a`.

## Python/JS contrast

**False friend: `append` is not `list.append`.**

In Python, `xs.append(4)` mutates the one list object in place and returns `None`. There is no "header" to copy. Two names either point at the same list object or at different ones, and `b = a + [99]` always builds a new list.

In JavaScript, `arr.push(4)` also mutates the one array object, and `[...a, 99]` always copies.

Go's `append` is a function that **returns a new slice value**, and that value may or may not share memory with its argument. That's why you always write `s = append(s, x)`. Throwing the result away doesn't compile. A bare `append(s, 2)` statement is reported as `append(s, 2) (value of type []int) is not used`.

Go chose this so the runtime can grow the backing array without an extra level of indirection: a slice is three words you can keep on the stack, not a pointer to a heap object like a Python list. The cost is this aliasing rule, which Python and JS don't have.

## Rebuild

The program is the trap again. You may edit it freely, but lines 7–9 (the two `append` calls and the `Println`) must stay exactly as they are. Make it print `99 42`.

## Challenge

Write `appendCopy(s []int, v int) []int`. It returns `s` with `v` appended, and the result must **never** share a backing array with `s`, no matter how much spare capacity `s` has.

The tests are hidden. They check values, but they also check that the input is untouched, that nothing was written into its spare capacity, and that writing to the result doesn't show through the input.

## Stretch

Break it: write a small program where two slices share a backing array *without* either being created by `append`, and a write through one changes what the other sees. Then explain in two sentences how `copy` or a three-index slice would have prevented it.
