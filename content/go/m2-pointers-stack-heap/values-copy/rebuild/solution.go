package main

import "fmt"

func reset(scores *[3]int) {
	for i := range scores {
		scores[i] = 0
	}
}

func main() {
	scores := [3]int{90, 85, 70}
	reset(&scores)
	fmt.Println(scores)
}
