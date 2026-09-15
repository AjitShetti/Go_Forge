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

// Oldest returns the person with the highest age. It says what it compares,
// so it doesn't need a type parameter: only Person has an Age.
func Oldest(people []Person) Person {
	best := people[0]
	for _, p := range people[1:] {
		if cmp.Compare(p.Age, best.Age) > 0 {
			best = p
		}
	}
	return best
}
