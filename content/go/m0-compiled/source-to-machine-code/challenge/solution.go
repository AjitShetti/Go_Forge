package main

import (
	"go/scanner"
	"go/token"
)

// InsertedSemicolons reports how many semicolons the Go scanner inserts
// automatically when it tokenizes src. Semicolons written in the source
// don't count.
func InsertedSemicolons(src string) int {
	fset := token.NewFileSet()
	file := fset.AddFile("src.go", fset.Base(), len(src))
	var s scanner.Scanner
	s.Init(file, []byte(src), nil, 0)
	n := 0
	for {
		_, tok, lit := s.Scan()
		if tok == token.EOF {
			return n
		}
		// A written semicolon has literal ";". An inserted one has "\n",
		// whether it came from a newline or from the end of the file.
		if tok == token.SEMICOLON && lit == "\n" {
			n++
		}
	}
}
