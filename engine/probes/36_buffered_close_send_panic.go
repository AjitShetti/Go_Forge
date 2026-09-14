package main

import "fmt"

func main() {
	ch := make(chan int, 2)
	ch <- 1
	ch <- 2
	fmt.Println(len(ch), cap(ch))
	close(ch)
	for v := range ch {
		fmt.Print(v, " ")
	}
	v, ok := <-ch
	fmt.Println(v, ok)
	defer func() { fmt.Println("recovered:", recover()) }()
	ch <- 3
}
