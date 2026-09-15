package main

import "fmt"

func main() {
	s := "héllo"
	fmt.Println(len(s), s[1], string(s[1]))
	for i, r := range s {
		fmt.Print(i, ":", string(r), " ")
	}
	fmt.Println()
}
