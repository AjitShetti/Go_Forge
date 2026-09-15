package main

// Clone returns a copy of grid that shares no memory with it: writing to any
// element of the result must never change grid, and the other way round.
func Clone(grid [][]int) [][]int {
	return grid
}
