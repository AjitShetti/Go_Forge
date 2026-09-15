package main

// TotalSize returns the sum of size(p) for every path.
//
// size is slow (think: a network call), so TotalSize must call it for all
// paths concurrently: every call must start before any of them has to
// finish. The hidden tests check that. It must also not return until every
// call has finished.
func TotalSize(paths []string, size func(path string) int) int {
	total := 0
	for _, p := range paths {
		total += size(p)
	}
	return total
}
