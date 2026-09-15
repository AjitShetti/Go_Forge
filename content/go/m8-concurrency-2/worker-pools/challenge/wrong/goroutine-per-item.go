package main

import "sync"

// Ordered and fast, but ignores limit: every item gets its own goroutine, so
// all of them run at once.
func ProcessAll(items []string, limit int, work func(string) string) []string {
	out := make([]string, len(items))
	var wg sync.WaitGroup
	for i, it := range items {
		wg.Go(func() {
			out[i] = work(it)
		})
	}
	wg.Wait()
	return out
}
