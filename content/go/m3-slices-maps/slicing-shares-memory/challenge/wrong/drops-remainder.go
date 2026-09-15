package main

// Copies correctly, but only emits full chunks.
func Chunk(xs []int, size int) [][]int {
	var chunks [][]int
	for i := 0; i+size <= len(xs); i += size {
		chunk := make([]int, size)
		copy(chunk, xs[i:i+size])
		chunks = append(chunks, chunk)
	}
	return chunks
}
