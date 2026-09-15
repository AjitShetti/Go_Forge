package main

import (
	"cmp"
	"fmt"
)

func main() {
	people := []Person{{"Ana", 34}, {"Bo", 71}, {"Cy", 19}}
	fmt.Println(Oldest(people).Name)
}

type Person struct {
	Name string
	Age  int
}

// Oldest returns the element with the highest age. It was made generic "to
// be reusable".
func Oldest[T cmp.Ordered](xs []T) T {
	best := xs[0]
	for _, x := range xs[1:] {
		if x > best {
			best = x
		}
	}
	return best
}
