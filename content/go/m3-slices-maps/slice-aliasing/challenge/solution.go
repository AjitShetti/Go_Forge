package main

// appendCopy returns s with v appended, in a new backing array.
func appendCopy(s []int, v int) []int {
	out := make([]int, len(s), len(s)+1)
	copy(out, s)
	return append(out, v)
}
