package main

import "fmt"

func main() {
	xs := []int{1, 2, 3}
	i := 5
	defer fmt.Println("deferred")
	fmt.Println("before")
	fmt.Println(xs[i])
	fmt.Println("after")
}
