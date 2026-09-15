package main

import "fmt"

func main() {
	m := map[string]int{"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}
	fmt.Println(m)

	first := ""
	same := true
	for i := 0; i < 50; i++ {
		order := ""
		for k := range m {
			order += k
		}
		if i == 0 {
			first = order
		} else if order != first {
			same = false
		}
	}
	fmt.Println("same order every time:", same)
}
