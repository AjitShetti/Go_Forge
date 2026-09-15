package main

// Compiles, but divides as integers and converts afterwards.
func Average(xs []int64) float64 {
	if len(xs) == 0 {
		return 0
	}
	var sum int64
	for _, x := range xs {
		sum += x
	}
	return float64(sum / int64(len(xs)))
}
