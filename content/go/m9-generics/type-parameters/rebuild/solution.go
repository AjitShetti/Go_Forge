package main

import (
	"cmp"
	"fmt"
)

func main() {
	fmt.Println(Max(3, 7), Max("go", "rust"), Clamp(15, 0, 10))
}

// Clamp limits v to the range lo..hi.
func Clamp[T cmp.Ordered](v, lo, hi T) T {
	return min(max(v, lo), hi)
}

// Max returns the larger of a and b.
func Max[T cmp.Ordered](a, b T) T {
	if a > b {
		return a
	}
	return b
}
