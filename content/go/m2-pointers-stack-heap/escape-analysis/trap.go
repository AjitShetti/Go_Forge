package main

import (
	"fmt"
	"testing"
)

type point struct{ x, y int }

//go:noinline
func byValue(x, y int) point {
	return point{x, y}
}

//go:noinline
func byPointer(x, y int) *point {
	return &point{x, y}
}

var total int

func main() {
	v := testing.AllocsPerRun(1000, func() {
		p := byValue(1, 2)
		total += p.x
	})
	ptr := testing.AllocsPerRun(1000, func() {
		p := byPointer(1, 2)
		total += p.x
	})
	fmt.Println(v, ptr)
}
