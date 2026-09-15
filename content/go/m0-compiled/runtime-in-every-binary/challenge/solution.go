package main

// At returns xs[i] and true. Like Python, a negative i counts from the end:
// -1 is the last element. If i is out of range either way, At returns 0 and
// false. At never panics.
func At(xs []int, i int) (int, bool) {
	if i < 0 {
		i += len(xs)
	}
	if i < 0 || i >= len(xs) {
		return 0, false
	}
	return xs[i], true
}
