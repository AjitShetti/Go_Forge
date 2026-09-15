package main

import "sync"

// TotalSize returns the sum of size(p) for every path.
//
// size is slow (think: a network call), so TotalSize must call it for all
// paths concurrently: every call must start before any of them has to
// finish. The hidden tests check that. It must also not return until every
// call has finished.
func TotalSize(paths []string, size func(path string) int) int {
	// Each goroutine writes only its own slot, so no two goroutines touch the
	// same memory. Adding up happens after Wait, back on one goroutine.
	sizes := make([]int, len(paths))
	var wg sync.WaitGroup
	for i, p := range paths {
		wg.Go(func() {
			sizes[i] = size(p)
		})
	}
	wg.Wait()

	total := 0
	for _, s := range sizes {
		total += s
	}
	return total
}
