package main

import "fmt"

func main() {
	squares := make(chan int)
	go produce(squares, 3)
	for s := range squares {
		fmt.Println(s)
	}
	fmt.Println("done")
}

func produce(out chan<- int, n int) {
	for i := 1; i <= n; i++ {
		out <- i * i
	}
}
