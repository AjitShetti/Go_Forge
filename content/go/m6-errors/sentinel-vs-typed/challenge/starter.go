package main

import (
	"errors"
	"fmt"
)

// ErrEmpty is returned for an empty string. Callers compare with ==.
var ErrEmpty = errors.New("port: empty")

// RangeError reports a number outside 1-65535. Callers use a type assertion
// to *RangeError to read Value.
type RangeError struct {
	Value int
}

func (e *RangeError) Error() string {
	return fmt.Sprintf("port %d out of range 1-65535", e.Value)
}

// SyntaxError reports input that isn't a decimal integer at all.
type SyntaxError struct {
	Input string
}

func (e *SyntaxError) Error() string {
	return fmt.Sprintf("port %q is not a number", e.Input)
}

// ParsePort parses a TCP port number.
//   - "" returns ErrEmpty
//   - anything strconv.Atoi rejects returns a *SyntaxError holding the input
//   - a number outside 1-65535 returns a *RangeError holding the number
func ParsePort(s string) (int, error) {
	return 0, nil
}
