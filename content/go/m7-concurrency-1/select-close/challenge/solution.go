package main

import "time"

// Merge collects values from a and b in the order they arrive, until both
// channels are closed, or until timeout has passed since Merge started,
// whichever comes first. It then returns what it collected.
func Merge(a, b <-chan int, timeout time.Duration) []int {
	// One timer for the whole call, created before the loop.
	deadline := time.After(timeout)
	var out []int
	for a != nil || b != nil {
		select {
		case v, ok := <-a:
			if !ok {
				// A closed channel is always ready. Setting it to nil disables
				// this case: receiving from a nil channel blocks forever, and
				// select skips cases that can't proceed.
				a = nil
				continue
			}
			out = append(out, v)
		case v, ok := <-b:
			if !ok {
				b = nil
				continue
			}
			out = append(out, v)
		case <-deadline:
			return out
		}
	}
	return out
}
