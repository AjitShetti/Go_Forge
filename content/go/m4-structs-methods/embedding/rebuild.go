package main

import "fmt"

type User struct {
	name string
}

func (u User) Name() string {
	return u.name
}

func (u User) Greeting() string {
	return "hello, " + u.Name()
}

type Admin struct {
	User
}

func (a Admin) Name() string {
	return "admin " + a.User.Name()
}

func main() {
	a := Admin{User{name: "ana"}}
	fmt.Println(a.Name())
	fmt.Println(a.Greeting())
}
