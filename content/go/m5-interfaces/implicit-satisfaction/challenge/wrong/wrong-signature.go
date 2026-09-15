package main

import (
	"fmt"
	"strings"
)

type Shape interface {
	Area() float64
}

// The optional method is Perimeter() float64. Asking for an int result is a
// different method set, so no shape ever matches.
func Summary(shapes []Shape) string {
	lines := make([]string, len(shapes))
	for i, s := range shapes {
		line := fmt.Sprintf("area %.2f", s.Area())
		if p, ok := s.(interface{ Perimeter() int }); ok {
			line += fmt.Sprintf(", perimeter %d.00", p.Perimeter())
		}
		lines[i] = line
	}
	return strings.Join(lines, "\n")
}
