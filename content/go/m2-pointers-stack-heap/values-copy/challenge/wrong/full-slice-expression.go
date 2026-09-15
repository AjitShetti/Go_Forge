package main

// Capping capacity stops appends from sharing, but writes still share.
func Clone(grid [][]int) [][]int {
	out := make([][]int, len(grid))
	for i, row := range grid {
		out[i] = row[:len(row):len(row)]
	}
	return out
}
