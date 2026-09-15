package main

import "testing"

func TestInsertedSemicolons(t *testing.T) {
	cases := []struct {
		name string
		src  string
		want int
	}{
		{"end of file counts", "x := 1", 1},
		{"written semicolon does not count", "x := 1; y := 2", 1},
		{"call at end of line", "f()\ng()\n", 2},
		{"brace on the same line", "func f() {\n}\n", 1},
		{"return keyword", "if x {\n\treturn\n}\n", 2},
		{"trailing comma", "a := []int{\n\t1,\n\t2,\n}\n", 1},
		{"increment", "x++\ny--\n", 2},
		{"line comment after code", "x := 1 // one\n", 1},
		{"only a comment", "// nothing here\n", 0},
		{"blank lines", "\n\n\n", 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := InsertedSemicolons(c.src); got != c.want {
				t.Errorf("InsertedSemicolons(%q) = %d, want %d", c.src, got, c.want)
			}
		})
	}
}
