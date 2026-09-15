package main

import "fmt"

func main() {
	a := make([]int, 3)
	b := append(a, 99)
	c := append(a, 42)
	fmt.Println(b[3], c[3])
}
