package main

// Gets FloorDiv right but makes the remainder always non-negative,
// which is wrong when b is negative.
func FloorDiv(a, b int) int {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

func FloorMod(a, b int) int {
	m := a % b
	if m < 0 {
		m = -m
	}
	return m
}
