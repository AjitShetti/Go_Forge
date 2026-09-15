package main

import "time"

// Correct close handling, but time.After runs on every loop iteration, so each
// value that arrives starts a fresh timeout. It's an idle timeout, not a total
// one.
func Merge(a, b <-chan int, timeout time.Duration) []int {
	var out []int
	for a != nil || b != nil {
		select {
		case v, ok := <-a:
			if !ok {
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
		case <-time.After(timeout):
			return out
		}
	}
	return out
}
