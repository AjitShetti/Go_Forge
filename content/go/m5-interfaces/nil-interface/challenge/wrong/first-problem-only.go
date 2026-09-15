package main

import "strings"

type User struct {
	Name  string
	Age   int
	Email string
}

type FieldError struct {
	Field, Problem string
}

type ValidationErrors []FieldError

func (v ValidationErrors) Error() string {
	parts := make([]string, len(v))
	for i, fe := range v {
		parts[i] = fe.Field + ": " + fe.Problem
	}
	return strings.Join(parts, "; ")
}

// Nil is handled correctly, but it stops at the first problem.
func Validate(u User) error {
	if u.Name == "" {
		return ValidationErrors{{"name", "must not be empty"}}
	}
	if u.Age < 0 || u.Age > 150 {
		return ValidationErrors{{"age", "must be between 0 and 150"}}
	}
	if !strings.Contains(u.Email, "@") {
		return ValidationErrors{{"email", "must contain @"}}
	}
	return nil
}
