package main

import "fmt"

func main() {
	var fns []func()
	for i := 0; i < 3; i++ {
		fns = append(fns, func() { fmt.Print(i, " ") })
	}
	for _, f := range fns {
		f()
	}
	fmt.Println()
	var ptrs []*int
	for _, v := range []int{10, 20, 30} {
		ptrs = append(ptrs, &v)
	}
	fmt.Println(*ptrs[0], *ptrs[1], *ptrs[2])
}
