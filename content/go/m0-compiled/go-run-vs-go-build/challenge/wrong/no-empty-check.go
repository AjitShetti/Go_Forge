package main

// Compiles, but 0.0 / 0.0 is NaN, not 0.
func Average(xs []int64) float64 {
	var sum int64
	for _, x := range xs {
		sum += x
	}
	return float64(sum) / float64(len(xs))
}
