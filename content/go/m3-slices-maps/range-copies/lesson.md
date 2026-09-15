---
{
  "slug": "range-copies",
  "title": "range hands you a copy",
  "concepts": ["range-copy", "value-semantics"],
  "requires": [],
  "trap": {
    "concept": "range-copy",
    "question": "Two loops. The first changes each player it's given. The second appends to the slice and writes to it while ranging over it. What does it print?",
    "kind": "choice",
    "choices": [
      "[{ana 15} {bo 25}]\n1 50 3 99\n[1 50 3 99]",
      "[{ana 10} {bo 20}]\n1 2 3\n[1 50 3 99]",
      "[{ana 10} {bo 20}]\n1 50 3\n[1 50 3 99]",
      "[{ana 15} {bo 25}]\n1 2 3\n[1 50 3 99]"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `[{book 18} {pen 2.25}]`. Lines 11 and 15 are locked.",
    "lockedLines": [11, 15]
  },
  "challenge": {
    "prompt": "Write `Promote(team, name)`, which bumps the Level of every employee with that name, in place.",
    "entry": "starter.go"
  }
}
---

## Provoke

The first loop gives every player 5 points. The second loop grows the slice it's walking over and writes into it.

## Decode

### The loop variable is a copy of the element

`for _, p := range players` works like this:

```
for i := 0; i < len(players); i++ {
    p := players[i]   // copy the struct
    p.Score += 5      // change the copy
}
```

`p` is its own variable, and each iteration **copies** the element into it. For a `Player`, that's the whole struct: a string header and an int. Writing to `p.Score` changes the copy, which is thrown away at the end of the iteration. It's the "assignment copies" rule from M2, hidden inside a `range`.

Since Go 1.22, `p` is a **new variable on every iteration** (M7 covers why that changed). Before that, one `p` was reused. Either way it's a copy, so the trap behaves the same on both versions.

To change the elements, index the slice, or take a pointer to the element itself:

```go verified id=modify-in-place
package main

import "fmt"

type Player struct {
	Name  string
	Score int
}

func main() {
	players := []Player{{"ana", 10}, {"bo", 20}}
	for i := range players {
		players[i].Score += 5
	}
	for i := range players {
		p := &players[i]
		p.Score *= 2
	}
	fmt.Println(players)
}
```

### The range expression is evaluated once

The second loop is stranger. `range nums` evaluates `nums` **once, before the first iteration**, and keeps that slice header: pointer to the original 3-element array, length 3.

1. On iteration 0, `append(nums, 99)` has no spare capacity (cap is 3), so it allocates a new array, copies `1 2 3` into it, adds `99`, and stores the new header in `nums`.
2. `nums[1] = 50` writes to the **new** array.
3. The loop is still walking the **old** array, with the old length of 3. It prints `1 2 3` and never sees the 50 or the 99.

The last `Println` reads the variable `nums`, which now holds the new header: `[1 50 3 99]`.

Change the capacity and the answer changes too, because then `append` writes into the same array the loop is reading. Output that depends on capacity is one more reason never to modify a slice's length while ranging over it.

### Ranging over an array copies the whole array

Arrays are values, so `range arr` copies **all of `arr`** before the loop starts. Writes during the loop aren't visible to it. With a slice, only the header is copied:

```go verified id=range-array-vs-slice
package main

import "fmt"

func main() {
	arr := [3]int{1, 2, 3}
	for i, v := range arr {
		if i == 0 {
			arr[1] = 50
		}
		fmt.Print(v, " ")
	}
	fmt.Println()

	s := []int{1, 2, 3}
	for i, v := range s {
		if i == 0 {
			s[1] = 50
		}
		fmt.Print(v, " ")
	}
	fmt.Println()
}
```

## Python/JS contrast

- **Python**: `for p in players:` binds `p` to **the same object** that's in the list, so `p.score += 5` changes the player. (For immutable ints, `x += 1` only rebinds `x`, which is a different trap.) Python iterates the live list, and appending inside the loop can make it run forever.
- **JavaScript**: `for (const p of players)` gives you the object reference, and `p.score += 5` sticks. `forEach` works the same way.
- **False friend:** Go's `for _, p := range players` looks exactly like `for p in players`, and does the opposite for structs. If you want Python's behavior in Go, use `[]*Player`, or loop with the index.

## Rebuild

A 10% discount that never applies. The cart and the `Println` are locked. Fix the loop.

## Challenge

Write `Promote(team, name)`. The hidden tests cover a nil team, a name that isn't there, a match at the start, and two employees with the same name, who both have to be promoted.

## Stretch

Change the trap's second loop so `nums` is created with `make([]int, 3, 10)` and then filled with 1, 2, 3. Predict the output, then run it. Now write a loop that correctly removes every even number from a slice *in place*, without ranging over the slice you're shrinking.
