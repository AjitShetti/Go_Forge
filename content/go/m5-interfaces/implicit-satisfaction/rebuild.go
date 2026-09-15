package main

import (
	"fmt"
	"strings"
)

func main() {
	var c LineCounter
	fmt.Fprintf(&c, "one\ntwo\n")
	fmt.Fprintln(&c, "three")
	fmt.Println(c.Lines)
}

type LineCounter struct {
	Lines int
}

func (c *LineCounter) Write(p string) int {
	c.Lines += strings.Count(p, "\n")
	return len(p)
}
