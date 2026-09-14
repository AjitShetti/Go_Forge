package main

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"
)

type upper struct{ w io.Writer }

func (u upper) Write(p []byte) (int, error) {
	return u.w.Write(bytes.ToUpper(p))
}

func main() {
	r := io.LimitReader(strings.NewReader("hello world, this is long"), 11)
	n, err := io.Copy(upper{os.Stdout}, r)
	fmt.Println()
	fmt.Println(n, err)
	sc := bufio.NewScanner(strings.NewReader("a b\nc"))
	for sc.Scan() {
		fmt.Printf("%q\n", sc.Text())
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "%05.2f|%-4s|%x", 3.14159, "go", 255)
	fmt.Println(sb.String())
	fmt.Fprintln(os.Stderr, "to stderr")
}
