package main

import (
	"fmt"
	"io"
	"strings"
)

func main() {
	r := io.MultiReader(strings.NewReader("abc"), strings.NewReader("def"))
	buf := make([]byte, 6)
	n, err := r.Read(buf)
	fmt.Println(n, err, string(buf[:n]))
	rest, err := io.ReadAll(r)
	fmt.Println(string(rest), err)
}
