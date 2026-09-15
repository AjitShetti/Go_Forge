package main

// Subtracts 1 whenever a is negative, even when the division is exact.
func FloorDiv(a, b int) int {
	if a < 0 {
		return a/b - 1
	}
	return a / b
}

func FloorMod(a, b int) int {
	return a - FloorDiv(a, b)*b
}
