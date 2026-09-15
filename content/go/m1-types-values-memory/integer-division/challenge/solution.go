package main

// FloorDiv returns a divided by b, rounded toward negative infinity,
// like Python's a // b. b is never 0.
func FloorDiv(a, b int) int {
	q := a / b
	// Go truncated toward zero. If there was a remainder and the signs
	// differ, the true quotient was negative and got rounded up: fix it.
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

// FloorMod returns the remainder that goes with FloorDiv, like Python's a % b:
// the result has the sign of b.
func FloorMod(a, b int) int {
	return a - FloorDiv(a, b)*b
}
