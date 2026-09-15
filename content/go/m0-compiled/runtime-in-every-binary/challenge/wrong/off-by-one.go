package main

// Lets i == len(xs) through, so the runtime's bounds check fires.
func At(xs []int, i int) (int, bool) {
	if i < 0 {
		i += len(xs)
	}
	if i < 0 || i > len(xs) {
		return 0, false
	}
	return xs[i], true
}
