package main

import "fmt"

func main() {
	temps := []int{-7, -3, -12, -5}
	var warmest int
	for _, t := range temps {
		if t > warmest {
			warmest = t
		}
	}
	fmt.Println("warmest:", warmest)
}
