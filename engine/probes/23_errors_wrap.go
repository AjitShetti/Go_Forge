package main

import (
	"errors"
	"fmt"
	"io/fs"
)

var ErrNotFound = errors.New("not found")

type QueryError struct {
	Query string
	Err   error
}

func (e *QueryError) Error() string { return e.Query + ": " + e.Err.Error() }
func (e *QueryError) Unwrap() error { return e.Err }

func find() error {
	return fmt.Errorf("find user: %w", &QueryError{"select", ErrNotFound})
}

func main() {
	err := find()
	fmt.Println(err)
	fmt.Println(errors.Is(err, ErrNotFound))
	var qe *QueryError
	fmt.Println(errors.As(err, &qe), qe.Query)
	fmt.Println(errors.Is(err, fs.ErrNotExist))
	joined := errors.Join(errors.New("a"), errors.New("b"))
	fmt.Println(joined)
}
