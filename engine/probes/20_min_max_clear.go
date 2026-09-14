package main

import "fmt"

func main() {
	fmt.Println(min(3, 1, 2), max(2.5, 1.0))
	m := map[string]int{"a": 1}
	clear(m)
	fmt.Println(len(m))
}
