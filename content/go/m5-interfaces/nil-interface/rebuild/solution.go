package main

import "fmt"

func main() {
	for _, age := range []int{30, -1} {
		if err := check(age); err != nil {
			fmt.Println(age, "error:", err)
		} else {
			fmt.Println(age, "ok")
		}
	}
}

type ValidationError struct {
	Field string
}

func (e *ValidationError) Error() string {
	return "invalid " + e.Field
}

func validateAge(age int) *ValidationError {
	if age < 0 {
		return &ValidationError{Field: "age"}
	}
	return nil
}

func check(age int) error {
	// Only convert to error when there is one: a nil *ValidationError
	// inside an error interface is not a nil error.
	if err := validateAge(age); err != nil {
		return err
	}
	return nil
}
