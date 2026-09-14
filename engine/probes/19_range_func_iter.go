package main

import "fmt"

func Count(n int) func(func(int) bool) {
	return func(yield func(int) bool) {
		for i := 0; i < n; i++ {
			if !yield(i) {
				return
			}
		}
	}
}

func main() {
	for v := range Count(4) {
		fmt.Print(v, " ")
	}
	fmt.Println()
}
