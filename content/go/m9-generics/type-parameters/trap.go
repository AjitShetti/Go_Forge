package main

import "fmt"

type Celsius float64

func Sum[T int | float64](xs []T) T {
	var total T
	for _, x := range xs {
		total += x
	}
	return total
}

func main() {
	temps := []Celsius{21.5, 19, 23}
	fmt.Println(Sum([]float64{1.5, 2}))
	fmt.Println(Sum(temps))
}
