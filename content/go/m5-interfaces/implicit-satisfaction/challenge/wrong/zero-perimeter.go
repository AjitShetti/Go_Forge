package main

import (
	"fmt"
	"strings"
)

type Shape interface {
	Area() float64
}

// Checks the capability, but reports a perimeter of 0 for shapes without one
// instead of leaving it out.
func Summary(shapes []Shape) string {
	lines := make([]string, len(shapes))
	for i, s := range shapes {
		perimeter := 0.0
		if p, ok := s.(interface{ Perimeter() float64 }); ok {
			perimeter = p.Perimeter()
		}
		lines[i] = fmt.Sprintf("area %.2f, perimeter %.2f", s.Area(), perimeter)
	}
	return strings.Join(lines, "\n")
}
