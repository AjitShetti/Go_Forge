package main

import "context"

// Numbers returns a channel that yields 0, 1, 2, ... for as long as ctx is
// alive.
//
// When ctx is cancelled, the goroutine behind the channel must stop and close
// the channel promptly, whether or not anyone is still reading from it.
func Numbers(ctx context.Context) <-chan int {
	out := make(chan int)
	go func() {
		// The producer closes: after this goroutine returns, nothing else sends.
		defer close(out)
		for i := 0; ; i++ {
			// Every blocking operation must also be able to see cancellation.
			// A send with no reader blocks forever, so it goes in a select.
			select {
			case out <- i:
			case <-ctx.Done():
				return
			}
		}
	}()
	return out
}
