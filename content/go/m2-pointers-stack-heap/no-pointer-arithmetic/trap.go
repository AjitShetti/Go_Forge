package main

import "fmt"

func main() {
	xs := [3]int{10, 20, 30}
	p := &xs[0]
	p++
	fmt.Println(*p)
}
