package main

import "context"

// Stops sending when ctx is cancelled, and nothing leaks. But the channel is
// never closed, so a reader ranging over it waits forever.
func Numbers(ctx context.Context) <-chan int {
	out := make(chan int)
	go func() {
		for i := 0; ; i++ {
			select {
			case out <- i:
			case <-ctx.Done():
				return
			}
		}
	}()
	return out
}
