package main

import "strings"

// Correct words, but strings.Split allocates a new []string on every call.
func Fields(dst []string, s string) []string {
	for _, w := range strings.Split(s, " ") {
		if w != "" {
			dst = append(dst, w)
		}
	}
	return dst
}
