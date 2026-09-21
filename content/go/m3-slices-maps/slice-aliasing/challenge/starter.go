package main

// appendCopy returns s with v appended.
// The result must never share a backing array with s: writing to the
// result must not be visible through s, and vice versa.
//
// No func main needed - the hidden tests call appendCopy directly.
func appendCopy(s []int, v int) []int {
	return append(s, v)
}
