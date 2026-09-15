package main

import "fmt"

func firstTwo(xs []int) []int {
	return xs[:2:2]
}

func main() {
	all := []int{1, 2, 3, 4}
	head := firstTwo(all)
	head = append(head, 99)
	fmt.Println(all, head)
}
