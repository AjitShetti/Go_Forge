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

// The sender closes: it's the only one who knows no more values are coming.
// range in main ends when the channel is closed and drained.
func produce(out chan<- int, n int) {
	defer close(out)
	for i := 1; i <= n; i++ {
		out <- i * i
	}
}
