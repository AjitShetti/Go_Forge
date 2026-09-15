package main

import "math"

// Multiplies as int32 (already wrapped), then widens. The check can never fire.
func MulInt32(a, b int32) (int32, bool) {
	p := int64(a * b)
	if p > math.MaxInt32 || p < math.MinInt32 {
		return 0, false
	}
	return int32(p), true
}
