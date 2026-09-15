package main

import (
	"bytes"
	"fmt"
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

// io.Writer's exact signature. Nothing declares that LineCounter implements
// io.Writer: having this method is all it takes.
func (c *LineCounter) Write(p []byte) (int, error) {
	c.Lines += bytes.Count(p, []byte("\n"))
	return len(p), nil
}
