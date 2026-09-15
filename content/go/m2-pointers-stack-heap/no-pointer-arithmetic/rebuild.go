package main

import "fmt"

func main() {
	xs := [3]int{10, 20, 30}
	total := 0
	p := &xs[0]
	for i := 0; i < len(xs); i++ {
		total += *p
		p++
	}
	fmt.Println("sum:", total)
}
