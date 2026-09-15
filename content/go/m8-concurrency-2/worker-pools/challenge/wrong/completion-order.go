package main

import "sync"

// A correct pool with a correct limit, but results are collected from a
// channel in the order workers finish, not the order of items.
func ProcessAll(items []string, limit int, work func(string) string) []string {
	jobs := make(chan string)
	results := make(chan string)
	var wg sync.WaitGroup
	for range limit {
		wg.Go(func() {
			for it := range jobs {
				results <- work(it)
			}
		})
	}
	go func() {
		for _, it := range items {
			jobs <- it
		}
		close(jobs)
	}()
	go func() {
		wg.Wait()
		close(results)
	}()
	var out []string
	for r := range results {
		out = append(out, r)
	}
	return out
}
