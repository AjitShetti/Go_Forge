package main

import "fmt"

type Point struct{ X, Y int }

func main() {
	a := [3]int{1, 2, 3}
	b := a
	b[0] = 100

	p := Point{1, 2}
	q := p
	q.X = 100

	s := []int{1, 2, 3}
	t := s
	t[0] = 100

	fmt.Println(a[0], p.X, s[0])
}
