package main

import "fmt"

func main() {
	var counts map[string]int
	fmt.Println(counts["go"], len(counts), counts == nil)
	delete(counts, "go")
	counts["go"]++
	fmt.Println("done")
}
