package main

import "fmt"

type User struct {
	Name string
	Age  int
	Tags []string
	Meta map[string]string
	Boss *User
}

func main() {
	var u User
	fmt.Println(u.Name == "", u.Age, u.Tags == nil, u.Meta == nil, u.Boss == nil)
	u.Tags = append(u.Tags, "admin")
	fmt.Printf("%q %v %d\n", u.Name, u.Tags, len(u.Meta))
}
