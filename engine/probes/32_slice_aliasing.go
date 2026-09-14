package main

import "fmt"

func main() {
	a := make([]int, 3, 4)
	b := append(a, 99)
	c := append(a, 42)
	fmt.Println(b[3], c[3], len(a), cap(a))
	s := []int{1, 2, 3, 4, 5}
	t := s[1:3]
	t[0] = 100
	fmt.Println(s, t, len(t), cap(t))
	for _, v := range s {
		v *= 2
		_ = v
	}
	fmt.Println(s)
}
