package main

import (
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("not found")

func load(id int) error {
	return fmt.Errorf("load user %d: %v", id, ErrNotFound)
}

func main() {
	err := load(7)
	fmt.Println(err)
	fmt.Println(errors.Is(err, ErrNotFound), errors.Unwrap(err) == nil)
}
