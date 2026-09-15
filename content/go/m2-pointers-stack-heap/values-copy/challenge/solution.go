package main

// Clone returns a copy of grid that shares no memory with it: writing to any
// element of the result must never change grid, and the other way round.
func Clone(grid [][]int) [][]int {
	if grid == nil {
		return nil
	}
	out := make([][]int, len(grid))
	for i, row := range grid {
		// Copying a row header would share the row's backing array.
		// Copy the elements into a new array instead.
		out[i] = make([]int, len(row))
		copy(out[i], row)
	}
	return out
}
