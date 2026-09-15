package main

import (
	"bytes"
	"fmt"
	"io"
)

func main() {
	var buf bytes.Buffer
	w := shout(&buf)
	fmt.Fprintf(w, "hello, %s\n", "gopher")
	io.WriteString(w, "bye\n")
	fmt.Print(buf.String())
}

// shout should return a Writer that upper-cases everything written to it
// before passing it on to w.
func shout(w io.Writer) io.Writer {
	return w
}
