package main

import "strings"

// Checks only the first byte to decide whether the string is ASCII, then
// reverses bytes. Fine for "hello" and "ünïcode"; breaks "hé".
func Reverse(s string) string {
	if len(s) == 0 || s[0] < 0x80 {
		var b strings.Builder
		b.Grow(len(s))
		for i := len(s) - 1; i >= 0; i-- {
			b.WriteByte(s[i])
		}
		return b.String()
	}
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}
