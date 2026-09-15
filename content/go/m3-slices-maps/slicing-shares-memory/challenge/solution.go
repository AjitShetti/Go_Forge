package main

// Chunk splits xs into consecutive pieces of length size (the last piece may
// be shorter). size is always at least 1. The chunks must share no memory
// with xs or with each other: writing to or appending to a chunk must never
// change xs or another chunk.
func Chunk(xs []int, size int) [][]int {
	var chunks [][]int
	for i := 0; i < len(xs); i += size {
		end := min(i+size, len(xs))
		// xs[i:end] is a window onto xs's array. Copy it into a new one.
		chunk := make([]int, end-i)
		copy(chunk, xs[i:end])
		chunks = append(chunks, chunk)
	}
	return chunks
}
