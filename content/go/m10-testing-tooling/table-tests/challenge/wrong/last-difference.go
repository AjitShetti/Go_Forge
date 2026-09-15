package main

import (
	"fmt"
	"slices"
)

// Keeps looping after the first mismatch and reports the last one instead.
func Explain(got, want []string) string {
	if slices.Equal(got, want) {
		return ""
	}
	if len(got) != len(want) {
		return fmt.Sprintf("got %d elements, want %d: %q vs %q", len(got), len(want), got, want)
	}
	msg := ""
	for i := range got {
		if got[i] != want[i] {
			msg = fmt.Sprintf("element %d: got %q, want %q", i, got[i], want[i])
		}
	}
	return msg
}
