package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

type User struct {
	ID       int      `json:"id"`
	Name     string   `json:"name"`
	Email    string   `json:"email,omitempty"`
	password string
	Tags     []string `json:"tags"`
}

func main() {
	b, err := json.Marshal(User{ID: 1, Name: "Ada", password: "x"})
	fmt.Println(string(b), err)
	var u User
	err = json.NewDecoder(strings.NewReader(`{"id":7,"name":"Bob","tags":["a"]}`)).Decode(&u)
	fmt.Printf("%+v %v\n", u, err)
}
