package main

import "strings"

// Only knows that ")" at the end of a line gets a semicolon.
func InsertedSemicolons(src string) int {
	n := 0
	for _, line := range strings.Split(src, "\n") {
		if strings.HasSuffix(strings.TrimSpace(line), ")") {
			n++
		}
	}
	return n
}
