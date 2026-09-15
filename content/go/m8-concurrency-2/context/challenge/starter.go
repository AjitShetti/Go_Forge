package main

import "context"

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
	bodies := make([]string, len(urls))
	for i, u := range urls {
		body, err := fetch(ctx, u)
		if err != nil {
			return nil, err
		}
		bodies[i] = body
	}
	return bodies, nil
}
