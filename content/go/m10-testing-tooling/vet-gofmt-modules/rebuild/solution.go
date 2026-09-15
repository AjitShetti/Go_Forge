package main

import (
	"fmt"
	"go/format"
)

func main() {
	out, err := format.Source([]byte(src))
	if err != nil {
		fmt.Println("gofmt refused:", err)
		return
	}
	fmt.Print(string(out))
}

// src is the file to format. Only change src.
//
// gofmt needs a file it can parse: the function was missing its closing brace.
// Everything else (spacing, indentation, blank lines) is gofmt's job.
const src = "package shop\nfunc Total(prices []int)int{\nt:=0\nfor _,p:=range prices{t+=p}\nreturn t\n}\n"
