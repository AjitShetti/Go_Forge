package main

import "unicode/utf8"

// Counts runes correctly, then cuts n bytes, which can split a character.
func Truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return s[:n] + "…"
}
