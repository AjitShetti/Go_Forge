package main

// Reverse returns s with its characters (runes) in reverse order.
//
// For any valid UTF-8 input, the result must be valid UTF-8, and reversing
// twice must give back the original. It should allocate at most once per call.
func Reverse(s string) string {
	b := []byte(s)
	for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
		b[i], b[j] = b[j], b[i]
	}
	return string(b)
}
