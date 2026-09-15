package main

import "fmt"

type Player struct {
	Name  string
	Score int
}

func main() {
	players := []Player{{"ana", 10}, {"bo", 20}}
	for _, p := range players {
		p.Score += 5
	}
	fmt.Println(players)

	nums := []int{1, 2, 3}
	for i, n := range nums {
		if i == 0 {
			nums = append(nums, 99)
			nums[1] = 50
		}
		fmt.Print(n, " ")
	}
	fmt.Println()
	fmt.Println(nums)
}
