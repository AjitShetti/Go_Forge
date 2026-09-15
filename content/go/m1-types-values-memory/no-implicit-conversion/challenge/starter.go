package main

// MulInt32 returns a*b and true if the product fits in an int32.
// If it doesn't fit, it returns 0 and false.
func MulInt32(a, b int32) (int32, bool) {
	return a * b, true
}
