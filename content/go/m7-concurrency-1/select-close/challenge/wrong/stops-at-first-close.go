package main

import "time"

// Handles the timeout, but treats one closed channel as "done", dropping
// whatever the other channel still has to say.
func Merge(a, b <-chan int, timeout time.Duration) []int {
	deadline := time.After(timeout)
	var out []int
	for {
		select {
		case v, ok := <-a:
			if !ok {
				return out
			}
			out = append(out, v)
		case v, ok := <-b:
			if !ok {
				return out
			}
			out = append(out, v)
		case <-deadline:
			return out
		}
	}
}
