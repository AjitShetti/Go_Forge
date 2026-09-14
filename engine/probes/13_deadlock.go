package main

import "fmt"

func main() {
	ch := make(chan int)
	fmt.Println("sending")
	ch <- 1
	fmt.Println("never")
}
