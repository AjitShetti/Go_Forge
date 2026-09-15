package main

import "strings"

// Assumes every line ends in a semicolon.
func InsertedSemicolons(src string) int {
	return strings.Count(src, "\n")
}
