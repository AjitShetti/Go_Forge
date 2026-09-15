package main

// Chunk splits xs into consecutive pieces of length size (the last piece may
// be shorter). size is always at least 1. The chunks must share no memory
// with xs or with each other: writing to or appending to a chunk must never
// change xs or another chunk.
func Chunk(xs []int, size int) [][]int {
	var chunks [][]int
	for i := 0; i < len(xs); i += size {
		end := min(i+size, len(xs))
		chunks = append(chunks, xs[i:end])
	}
	return chunks
}
