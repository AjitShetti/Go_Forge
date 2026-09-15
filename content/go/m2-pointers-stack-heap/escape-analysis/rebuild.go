package main

import (
	"fmt"
	"testing"
)

type point struct{ x, y int }

//go:noinline
func newPoint(x, y int) *point {
	return &point{x, y}
}

var sink *point

func main() {
	allocs := testing.AllocsPerRun(1000, func() {
		sink = newPoint(1, 2)
	})
	fmt.Println("allocs per call:", allocs)
}
