package main

import "fmt"

func main() {
	nums := []int{1, 2, 3, 4, 5}
	window := nums[1:3]
	window[0] = 20
	window = append(window, 40)
	fmt.Println(nums)
	fmt.Println(len(window), cap(window))
}
