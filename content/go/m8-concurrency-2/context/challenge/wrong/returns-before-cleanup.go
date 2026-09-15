package main

import "context"

type result struct {
	i    int
	body string
	err  error
}

// Cancels on the first error and returns immediately, but the deferred cancel
// only asks the other fetches to stop. They're still running when FetchAll
// has returned.
func FetchAll(ctx context.Context, urls []string, fetch func(ctx context.Context, url string) (string, error)) ([]string, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	results := make(chan result, len(urls))
	for i, u := range urls {
		go func() {
			body, err := fetch(ctx, u)
			results <- result{i, body, err}
		}()
	}
	bodies := make([]string, len(urls))
	for range urls {
		r := <-results
		if r.err != nil {
			return nil, r.err
		}
		bodies[r.i] = r.body
	}
	return bodies, nil
}
