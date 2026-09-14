package main

import "fmt"

func main() {
	fmt.Println("blocking")
	select {}
}
