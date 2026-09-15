package main

// Truncate returns s unchanged if it has at most n characters (runes).
// Otherwise it returns the first n characters followed by "…".
func Truncate(s string, n int) string {
	count := 0
	for i := range s {
		// i is the byte offset where each rune starts.
		if count == n {
			return s[:i] + "…"
		}
		count++
	}
	return s
}
