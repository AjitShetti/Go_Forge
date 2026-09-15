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
	var b strings.Builder
	for i, w := range words {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(w)
	}
	return b.String()
}
