package main

// Capping capacity makes appends reallocate, but writes still hit xs.
func Chunk(xs []int, size int) [][]int {
	var chunks [][]int
	for i := 0; i < len(xs); i += size {
		end := min(i+size, len(xs))
		chunks = append(chunks, xs[i:end:end])
	}
	return chunks
}
