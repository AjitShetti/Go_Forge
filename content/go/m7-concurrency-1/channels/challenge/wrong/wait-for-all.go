package main

import "sync"

// No leak and the fastest result wins, but it waits for every fn first.
func First(fns ...func() string) string {
	results := make(chan string, len(fns))
	var wg sync.WaitGroup
	for _, fn := range fns {
		wg.Go(func() {
			results <- fn()
		})
	}
	wg.Wait()
	return <-results
}
