package main

import "fmt"

type Speaker interface {
	Speak() string
}

type Dog struct {
	name string
}

func (d *Dog) Speak() string {
	return d.name + " says woof"
}

func main() {
	d := Dog{name: "rex"}
	fmt.Println(d.Speak())
	var s Speaker = d
	fmt.Println(s.Speak())
}
