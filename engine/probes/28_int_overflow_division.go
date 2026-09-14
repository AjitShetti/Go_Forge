package main

import "fmt"

func main() {
	var i8 int8 = 127
	i8++
	fmt.Println(i8)
	fmt.Println(7/2, -7/2, 7%3, -7%3, 7.0/2)
	var u uint8 = 0
	u--
	fmt.Println(u)
}
