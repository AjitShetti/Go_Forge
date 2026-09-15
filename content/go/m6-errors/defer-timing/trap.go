package main

import "fmt"

func main() {
	x := 1
	defer fmt.Println("deferred arg:", x)
	defer func() {
		fmt.Println("deferred closure:", x)
	}()
	x = 2
	fmt.Println("body:", x)
}
