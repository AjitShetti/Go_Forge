package main

import "fmt"

type NotFoundError struct {
	Key string
}

func (e *NotFoundError) Error() string {
	return "not found: " + e.Key
}

func find(key string) error {
	var err *NotFoundError
	if key == "missing" {
		err = &NotFoundError{Key: key}
	}
	return err
}

func main() {
	err := find("present")
	if err != nil {
		fmt.Println("failed:", err)
		return
	}
	fmt.Println("ok")
}
