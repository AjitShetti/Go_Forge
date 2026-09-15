package main

// Cuts at a rune boundary, but decides whether to cut using the byte length.
func Truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	r := []rune(s)
	if n > len(r) {
		n = len(r)
	}
	return string(r[:n]) + "…"
}
