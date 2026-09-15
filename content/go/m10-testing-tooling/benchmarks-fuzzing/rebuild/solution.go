package main

import (
	"fmt"
	"strings"
	"testing"
)

var sink string

func main() {
	words := []string{"alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"}
	fmt.Println(csv(words))
	fmt.Println(testing.AllocsPerRun(100, func() { sink = csv(words) }))
}

// csv joins words with commas.
func csv(words []string) string {
	// Size the buffer once: len of every word plus the commas. Without Grow,
	// the Builder starts empty and reallocates each time it runs out of room.
	n := len(words) - 1
	for _, w := range words {
		n += len(w)
	}
	var b strings.Builder
	b.Grow(n)
	for i, w := range words {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(w)
	}
	return b.String()
}
