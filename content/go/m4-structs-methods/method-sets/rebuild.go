package main

import "fmt"

type Shape interface {
	Area() float64
	Scale(f float64)
}

type Rect struct {
	W, H float64
}

func (r Rect) Area() float64 {
	return r.W * r.H
}

func (r Rect) Scale(f float64) {
	r.W *= f
	r.H *= f
}

func main() {
	shapes := []Shape{&Rect{W: 1, H: 2}, &Rect{W: 3, H: 4}}
	for _, s := range shapes {
		s.Scale(2)
	}
	fmt.Println(shapes[0].Area(), shapes[1].Area())
}
