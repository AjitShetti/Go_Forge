package main

// Looks like a copy, isn't: s[:] is a new header over the same array.
func appendCopy(s []int, v int) []int {
	out := s[:]
	return append(out, v)
}
