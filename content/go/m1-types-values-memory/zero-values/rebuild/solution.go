package main

import "fmt"

func main() {
	temps := []int{-7, -3, -12, -5}
	warmest := temps[0]
	for _, t := range temps[1:] {
		if t > warmest {
			warmest = t
		}
	}
	fmt.Println("warmest:", warmest)
}
