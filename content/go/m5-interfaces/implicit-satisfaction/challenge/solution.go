package main

import (
	"fmt"
	"strings"
)

// Shape is all Summary needs from a shape.
type Shape interface {
	Area() float64
}

// perimeterer is the optional capability. It's unexported and declared here,
// by the code that uses it: the shapes never mention it.
type perimeterer interface {
	Perimeter() float64
}

// Summary describes each shape on its own line, joined with "\n":
//
//	area 4.00
//	area 4.00, perimeter 8.00
//
// The perimeter part appears only for shapes that also have a
// Perimeter() float64 method. Shapes don't declare that; you have to ask.
func Summary(shapes []Shape) string {
	lines := make([]string, len(shapes))
	for i, s := range shapes {
		line := fmt.Sprintf("area %.2f", s.Area())
		// The assertion checks the dynamic type's method set at runtime,
		// signature included.
		if p, ok := s.(perimeterer); ok {
			line += fmt.Sprintf(", perimeter %.2f", p.Perimeter())
		}
		lines[i] = line
	}
	return strings.Join(lines, "\n")
}
