package main

import (
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("not found")

func lookup(id int) error {
	if id != 1 {
		return errors.New("not found")
	}
	return nil
}

func main() {
	err := lookup(2)
	fmt.Println(err)
	fmt.Println(err == ErrNotFound, err.Error() == ErrNotFound.Error())
}
