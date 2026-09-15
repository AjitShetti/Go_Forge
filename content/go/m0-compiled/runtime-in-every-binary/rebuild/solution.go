package main

import "fmt"

func main() {
	xs := []int{1, 2, 3}
	total := 0
	for i := 0; i < len(xs); i++ {
		total += xs[i]
	}
	fmt.Println("total:", total)
}
