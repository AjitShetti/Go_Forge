package main

import "fmt"

type T struct{ X int }

func main() {
	var p *T
	fmt.Println(p.X)
}
