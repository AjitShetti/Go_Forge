package main

import "strings"

// Correct words, but builds each one byte by byte into new memory.
func Fields(dst []string, s string) []string {
	var b strings.Builder
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ' ' {
			if b.Len() > 0 {
				dst = append(dst, b.String())
				b = strings.Builder{}
			}
			continue
		}
		b.WriteByte(s[i])
	}
	return dst
}
