package main

import (
	"encoding/json"
	"fmt"
)

type User struct {
	Name  string `json:"name"`
	email string `json:"email"`
	Age   int    `json:"age,omitempty"`
	Admin bool   `json:"-"`
}

func main() {
	b, err := json.Marshal(User{Name: "Ana", email: "ana@example.com", Age: 0, Admin: true})
	fmt.Println(string(b), err)
}
