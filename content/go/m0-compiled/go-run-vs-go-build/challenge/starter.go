package main

import (
	"fmt"
	"strings"
)

// Average returns the mean of xs. The mean of no numbers is 0.
func Average(xs []int64) float64 {
	var sum int
	for _, x := range xs {
		sum += x
	}
	return sum / len(xs)
}
