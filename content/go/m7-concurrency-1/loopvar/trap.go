package main

import "fmt"

func main() {
	var prints []func()
	for i := 0; i < 3; i++ {
		prints = append(prints, func() { fmt.Print(i, " ") })
	}
	for _, p := range prints {
		p()
	}
	fmt.Println()
}
