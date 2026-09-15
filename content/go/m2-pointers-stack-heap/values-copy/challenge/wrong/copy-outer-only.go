package main

// copy() copies the row headers, so every row still points at grid's arrays.
func Clone(grid [][]int) [][]int {
	out := make([][]int, len(grid))
	copy(out, grid)
	return out
}
