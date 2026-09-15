package main

import (
	"fmt"
	"reflect"
)

// reflect.DeepEqual says a nil slice and an empty slice differ, so a test
// fails with "got 0 elements, want 0".
func Explain(got, want []string) string {
	if reflect.DeepEqual(got, want) {
		return ""
	}
	if len(got) != len(want) {
		return fmt.Sprintf("got %d elements, want %d: %q vs %q", len(got), len(want), got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			return fmt.Sprintf("element %d: got %q, want %q", i, got[i], want[i])
		}
	}
	return fmt.Sprintf("got %d elements, want %d: %q vs %q", len(got), len(want), got, want)
}
