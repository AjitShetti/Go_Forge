package main

import (
	"context"
	"sync"
)

// Concurrent, ordered, and it waits. But it never cancels anything: after the
// first failure, every other fetch runs to completion first.
func FetchAll(ctx context.Context, urls []string, fetch func(ctx context.Context, url string) (string, error)) ([]string, error) {
	bodies := make([]string, len(urls))
	var (
		wg       sync.WaitGroup
		once     sync.Once
		firstErr error
	)
	for i, u := range urls {
		wg.Go(func() {
			body, err := fetch(ctx, u)
			if err != nil {
				once.Do(func() { firstErr = err })
				return
			}
			bodies[i] = body
		})
	}
	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}
	return bodies, nil
}
