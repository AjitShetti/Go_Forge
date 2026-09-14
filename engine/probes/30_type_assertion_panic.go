package main

import "fmt"

func main() {
	var v interface{} = "text"
	n, ok := v.(int)
	fmt.Println(n, ok)
	fmt.Println(v.(int))
}
