package main

import (
	"errors"
	"fmt"
)

func main() {
	err := readConfig("app.yaml")
	var pe *ParseError
	if errors.As(err, &pe) {
		fmt.Println("line", pe.Line, "in", err)
	} else {
		fmt.Println("other:", err)
	}
}

type ParseError struct {
	Line int
	Msg  string
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("%s at line %d", e.Msg, e.Line)
}

func parse(src string) error {
	return &ParseError{Line: 3, Msg: "bad indent"}
}

func readConfig(name string) error {
	if err := parse("..."); err != nil {
		return fmt.Errorf("read config %s: %w", name, err)
	}
	return nil
}
