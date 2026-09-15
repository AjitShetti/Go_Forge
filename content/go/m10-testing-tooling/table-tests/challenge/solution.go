package main

import (
	"fmt"
	"slices"
)

// Explain compares got with want for a table-driven test and returns "" when
// they match, or a failure message that points at the problem.
//
//   - A nil slice and an empty slice match.
//   - Different lengths: "got 1 elements, want 2: [\"a\"] vs [\"a\" \"b\"]"
//     (use %d for the lengths and %q for both slices).
//   - Same length: describe the FIRST differing element:
//     "element 1: got \"b \", want \"b\"" (use %q for both elements).
func Explain(got, want []string) string {
	// slices.Equal treats nil and empty as equal. reflect.DeepEqual doesn't.
	if slices.Equal(got, want) {
		return ""
	}
	if len(got) != len(want) {
		return fmt.Sprintf("got %d elements, want %d: %q vs %q", len(got), len(want), got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			// %q shows trailing spaces, tabs and empty strings, which %v hides.
			return fmt.Sprintf("element %d: got %q, want %q", i, got[i], want[i])
		}
	}
	return ""
}
