package main

import (
	"fmt"
	"slices"
)

// Prints elements with %v, so "b " and "b" look identical in the message.
func Explain(got, want []string) string {
	if slices.Equal(got, want) {
		return ""
	}
	if len(got) != len(want) {
		return fmt.Sprintf("got %d elements, want %d: %q vs %q", len(got), len(want), got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			return fmt.Sprintf("element %d: got %v, want %v", i, got[i], want[i])
		}
	}
	return ""
}
