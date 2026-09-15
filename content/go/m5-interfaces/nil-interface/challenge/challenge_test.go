package main

import (
	"errors"
	"testing"
)

func TestValidate(t *testing.T) {
	valid := User{Name: "Ana", Age: 34, Email: "ana@example.com"}

	t.Run("valid user is a nil error", func(t *testing.T) {
		if err := Validate(valid); err != nil {
			t.Fatalf("Validate(valid) = %#v (dynamic type %T), want a nil error", err, err)
		}
	})
	t.Run("boundary ages are valid", func(t *testing.T) {
		for _, age := range []int{0, 150} {
			u := valid
			u.Age = age
			if err := Validate(u); err != nil {
				t.Errorf("age %d: got error %v (dynamic type %T), want nil", age, err, err)
			}
		}
	})
	t.Run("one problem", func(t *testing.T) {
		u := valid
		u.Email = "ana.example.com"
		err := Validate(u)
		var ve ValidationErrors
		if !errors.As(err, &ve) {
			t.Fatalf("Validate = %#v, want a ValidationErrors", err)
		}
		if len(ve) != 1 || ve[0] != (FieldError{"email", "must contain @"}) {
			t.Fatalf("got %v, want exactly the email problem", ve)
		}
	})
	t.Run("every problem, in field order", func(t *testing.T) {
		err := Validate(User{Name: "", Age: -3, Email: "nope"})
		if err == nil {
			t.Fatal("Validate = nil, want errors")
		}
		want := "name: must not be empty; age: must be between 0 and 150; email: must contain @"
		if err.Error() != want {
			t.Fatalf("Error() = %q\nwant      %q", err.Error(), want)
		}
	})
	t.Run("valid after invalid", func(t *testing.T) {
		_ = Validate(User{})
		if err := Validate(valid); err != nil {
			t.Fatalf("Validate(valid) after an invalid call = %#v (%T), want nil", err, err)
		}
	})
}
