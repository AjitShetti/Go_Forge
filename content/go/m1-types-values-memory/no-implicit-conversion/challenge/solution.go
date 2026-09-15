package main

import "math"

// MulInt32 returns a*b and true if the product fits in an int32.
// If it doesn't fit, it returns 0 and false.
func MulInt32(a, b int32) (int32, bool) {
	// Widen first: the product of two int32s always fits in an int64.
	p := int64(a) * int64(b)
	if p > math.MaxInt32 || p < math.MinInt32 {
		return 0, false
	}
	return int32(p), true
}
