package main

import (
	"context"
	"sync"
)

// FetchAll calls fetch for every url concurrently and returns the bodies in
// the same order as urls.
//
// If any fetch fails, FetchAll returns that first error and cancels every
// fetch still running, so the caller isn't kept waiting for work whose result
// will be thrown away. If ctx is cancelled or times out, FetchAll returns
// promptly with an error that errors.Is matches to ctx's error.
//
// FetchAll must not return while any fetch is still running.
func FetchAll(ctx context.Context, urls []string, fetch func(ctx context.Context, url string) (string, error)) ([]string, error) {
	// A child context: cancelling it stops our fetches without touching the
	// caller's ctx. If the caller's ctx is cancelled, this one is too.
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

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
				// The first failure records itself and cancels the rest. Later
				// failures (usually context.Canceled, caused by that cancel)
				// don't overwrite it.
				once.Do(func() {
					firstErr = err
					cancel()
				})
				return
			}
			bodies[i] = body
		})
	}
	// Cancelling asks fetches to stop; it doesn't wait for them. Wait does.
	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}
	return bodies, nil
}
