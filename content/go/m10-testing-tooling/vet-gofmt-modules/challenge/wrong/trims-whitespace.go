package main

import (
	"go/format"
	"slices"
	"strings"
)

// Trims both sides before comparing, so a file without its final newline, or
// with extra blank lines at the end, counts as formatted.
func Unformatted(files map[string]string) []string {
	var bad []string
	for name, src := range files {
		out, err := format.Source([]byte(src))
		if err != nil {
			bad = append(bad, name+" (syntax error)")
			continue
		}
		if strings.TrimSpace(string(out)) != strings.TrimSpace(src) {
			bad = append(bad, name)
		}
	}
	slices.Sort(bad)
	return bad
}
