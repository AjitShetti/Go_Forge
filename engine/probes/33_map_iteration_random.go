package main

import "fmt"

func main() {
	m := map[int]bool{}
	for i := 0; i < 20; i++ {
		m[i] = true
	}
	orders := map[string]bool{}
	for trial := 0; trial < 20; trial++ {
		s := ""
		for k := range m {
			s += fmt.Sprint(k, ",")
		}
		orders[s] = true
	}
	fmt.Println("distinct orders > 1:", len(orders) > 1)
	fmt.Println(map[string]int{"z": 1, "a": 2})
}
