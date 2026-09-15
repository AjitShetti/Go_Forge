package main

import (
	"strings"
	"unicode/utf8"
)

// Reverse returns s with its characters (runes) in reverse order.
//
// For any valid UTF-8 input, the result must be valid UTF-8, and reversing
// twice must give back the original. It should allocate at most once per call.
func Reverse(s string) string {
	// Reversing bytes splits multi-byte characters. Walk runes from the end
	// instead, and write them into a Builder sized for the whole string up
	// front: one allocation, and String() hands back that buffer without
	// copying it.
	var b strings.Builder
	b.Grow(len(s))
	for len(s) > 0 {
		r, size := utf8.DecodeLastRuneInString(s)
		b.WriteRune(r)
		s = s[:len(s)-size]
	}
	return b.String()
}
