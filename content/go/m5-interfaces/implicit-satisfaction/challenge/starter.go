package main

// Shape is all Summary needs from a shape.
type Shape interface {
	Area() float64
}

// Summary describes each shape on its own line, joined with "\n":
//
//	area 4.00
//	area 4.00, perimeter 8.00
//
// The perimeter part appears only for shapes that also have a
// Perimeter() float64 method. Shapes don't declare that; you have to ask.
func Summary(shapes []Shape) string {
	return ""
}
