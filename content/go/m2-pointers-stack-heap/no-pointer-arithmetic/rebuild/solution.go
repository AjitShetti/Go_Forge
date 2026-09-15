package main

import "fmt"

func main() {
	xs := [3]int{10, 20, 30}
	total := 0
	for i := 0; i < len(xs); i++ {
		p := &xs[i]
		total += *p
	}
	fmt.Println("sum:", total)
}
