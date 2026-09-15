package main

// The classic "divide the product back" check. It misses MinInt32 * -1,
// because MinInt32 / -1 wraps back to MinInt32 in Go instead of panicking.
func MulInt32(a, b int32) (int32, bool) {
	p := a * b
	if b != 0 && p/b != a {
		return 0, false
	}
	return p, true
}
