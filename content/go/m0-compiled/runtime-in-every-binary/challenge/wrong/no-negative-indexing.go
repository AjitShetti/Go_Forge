package main

// Never panics, but treats every negative index as out of range.
func At(xs []int, i int) (int, bool) {
	if i < 0 || i >= len(xs) {
		return 0, false
	}
	return xs[i], true
}
