package main

import "sync"

// Uses a goroutine and a WaitGroup, but waits for each call before starting
// the next: correct total, no concurrency.
func TotalSize(paths []string, size func(path string) int) int {
	total := 0
	for _, p := range paths {
		var wg sync.WaitGroup
		var n int
		wg.Go(func() {
			n = size(p)
		})
		wg.Wait()
		total += n
	}
	return total
}
