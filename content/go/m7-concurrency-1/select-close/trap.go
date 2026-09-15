package main

import "fmt"

func main() {
	ch := make(chan int, 3)
	ch <- 1
	ch <- 2
	close(ch)
	for i := 0; i < 4; i++ {
		v, ok := <-ch
		fmt.Println(v, ok)
	}
}
