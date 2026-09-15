package main

import "time"

// Merge collects values from a and b in the order they arrive, until both
// channels are closed, or until timeout has passed since Merge started,
// whichever comes first. It then returns what it collected.
func Merge(a, b <-chan int, timeout time.Duration) []int {
	return nil
}
