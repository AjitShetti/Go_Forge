package main

// Copies, but into a slice that still has s's spare capacity behind it.
func appendCopy(s []int, v int) []int {
	out := make([]int, len(s))
	copy(out, s)
	s = append(s, v)
	return append(out, v)
}
