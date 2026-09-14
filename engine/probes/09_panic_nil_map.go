package main

import "fmt"

func main() {
	var m map[string]int
	fmt.Println(m["missing"], len(m))
	m["boom"] = 1
}
