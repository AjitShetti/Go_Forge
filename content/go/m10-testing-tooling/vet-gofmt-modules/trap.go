package main

import (
	"fmt"
	"go/format"
	"strings"
)

func main() {
	src := "package p\nfunc f(a,b,c int)int{\nreturn a*b+c*(a-b)\n}\n"
	out, err := format.Source([]byte(src))
	lines := strings.Split(string(out), "\n")
	fmt.Println(strings.TrimSpace(lines[3]), err)
}
