package main

import "fmt"

type Item struct {
	Name  string
	Price float64
}

func main() {
	cart := []Item{{"book", 20}, {"pen", 2.5}}
	for i := range cart {
		cart[i].Price = cart[i].Price * 0.9
	}
	fmt.Println(cart)
}
