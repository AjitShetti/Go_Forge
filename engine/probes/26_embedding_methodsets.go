package main

import "fmt"

type Animal struct{ Name string }

func (a Animal) Speak() string { return a.Name + " makes a sound" }
func (a *Animal) Rename(n string) { a.Name = n }

type Dog struct {
	Animal
	Breed string
}

func (d Dog) Speak() string { return d.Name + " barks" }

type Speaker interface{ Speak() string }
type Renamer interface{ Rename(string) }

func main() {
	d := Dog{Animal{"Rex"}, "lab"}
	fmt.Println(d.Speak(), "|", d.Animal.Speak())
	d.Rename("Max")
	fmt.Println(d.Name)
	var s Speaker = d
	fmt.Println(s.Speak())
	var r Renamer = &d
	r.Rename("Bo")
	fmt.Println(d.Name)
	_, ok := interface{}(d).(Renamer)
	fmt.Println("Dog value implements Renamer:", ok)
}
