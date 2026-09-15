package main

// FloorDiv returns a divided by b, rounded toward negative infinity,
// like Python's a // b. b is never 0.
func FloorDiv(a, b int) int {
	return a / b
}

// FloorMod returns the remainder that goes with FloorDiv, like Python's a % b:
// the result has the sign of b.
func FloorMod(a, b int) int {
	return a % b
}
