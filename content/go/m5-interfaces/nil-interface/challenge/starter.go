package main

import "strings"

type User struct {
	Name  string
	Age   int
	Email string
}

// FieldError is one problem with one field.
type FieldError struct {
	Field, Problem string
}

// ValidationErrors is every problem found, in field order: Name, Age, Email.
type ValidationErrors []FieldError

func (v ValidationErrors) Error() string {
	parts := make([]string, len(v))
	for i, fe := range v {
		parts[i] = fe.Field + ": " + fe.Problem
	}
	return strings.Join(parts, "; ")
}

// Validate returns nil when u is valid. Otherwise it returns ValidationErrors
// listing every problem:
//   - Name must not be empty ("must not be empty")
//   - Age must be 0 to 150 ("must be between 0 and 150")
//   - Email must contain "@" ("must contain @")
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
	return errs
}
