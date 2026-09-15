package main

import "context"

// Checks for cancellation before each send, and closes the channel. But once
// it's inside a send with no reader, it never gets back to the check.
func Numbers(ctx context.Context) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for i := 0; ; i++ {
			if ctx.Err() != nil {
				return
			}
			out <- i
		}
	}()
	return out
}
