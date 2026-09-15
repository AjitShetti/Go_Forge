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

// Tries to fix it with a pointer that stays nil when nothing failed. A nil
// *ValidationErrors in an error is still a non-nil error.
func Validate(u User) error {
	var errs ValidationErrors
	if u.Name == "" {
		errs = append(errs, FieldError{"name", "must not be empty"})
	}
	if u.Age < 0 || u.Age > 150 {
		errs = append(errs, FieldError{"age", "must be between 0 and 150"})
	}
	if !strings.Contains(u.Email, "@") {
		errs = append(errs, FieldError{"email", "must contain @"})
	}
	var result *ValidationErrors
	if len(errs) > 0 {
		result = &errs
	}
	return result
}
