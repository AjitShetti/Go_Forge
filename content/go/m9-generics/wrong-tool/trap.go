package main

import "fmt"

func Index[T comparable](xs []T, v T) int {
	for i, x := range xs {
		if x == v {
			return i
		}
	}
	return -1
}

func main() {
	fmt.Println(Index([]string{"a", "b"}, "b"))
	events := []any{42, "login", []string{"admin"}}
	fmt.Println(Index(events, "login"))
	fmt.Println(Index(events, any([]string{"admin"})))
}
