package main

import "fmt"

type Point struct{ X, Y int }

func move(p Point) { p.X = 100 }
func movePtr(p *Point) { p.X = 100 }

func main() {
	p := Point{1, 2}
	move(p)
	fmt.Println(p)
	movePtr(&p)
	fmt.Println(p)
	a := [3]int{1, 2, 3}
	b := a
	b[0] = 9
	fmt.Println(a, b)
}
