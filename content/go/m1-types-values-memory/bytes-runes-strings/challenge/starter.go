package main

// Truncate returns s unchanged if it has at most n characters (runes).
// Otherwise it returns the first n characters followed by "…".
func Truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
