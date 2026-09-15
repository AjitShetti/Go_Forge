package main

import "sync"

// ProcessAll runs work on every item, with at most limit calls to work
// running at the same time (limit >= 1), and returns the results in the same
// order as items.
//
// work is slow (think: resizing an image), so ProcessAll should actually use
// its limit: with 12 items and a limit of 4, it should take about 3 times as
// long as one call, not 12 times.
func ProcessAll(items []string, limit int, work func(string) string) []string {
	// Jobs carry their index, so each worker writes its result into the right
	// slot. Workers finish in any order; the slice keeps the input order.
	type job struct {
		i    int
		item string
	}
	jobs := make(chan job)
	out := make([]string, len(items))

	// Exactly limit workers: that's what bounds the concurrency.
	var wg sync.WaitGroup
	for range limit {
		wg.Go(func() {
			for j := range jobs {
				out[j.i] = work(j.item)
			}
		})
	}
	for i, it := range items {
		jobs <- job{i, it}
	}
	close(jobs)
	wg.Wait()
	return out
}
