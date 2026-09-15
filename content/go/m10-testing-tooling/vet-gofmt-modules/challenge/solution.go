package main

import (
	"bytes"
	"go/format"
	"slices"
)

// Unformatted is a tiny `gofmt -l`. It returns, sorted by name, every file
// whose content isn't exactly what gofmt would produce, byte for byte, final
// newline included. A file that doesn't parse is reported as
// "<name> (syntax error)" instead of its plain name.
func Unformatted(files map[string]string) []string {
	var bad []string
	for name, src := range files {
		out, err := format.Source([]byte(src))
		if err != nil {
			bad = append(bad, name+" (syntax error)")
			continue
		}
		// gofmt's output is canonical, so "formatted" means "unchanged by
		// gofmt". No trimming: a missing final newline is a difference.
		if !bytes.Equal(out, []byte(src)) {
			bad = append(bad, name)
		}
	}
	// Map iteration order is random; the report must not be.
	slices.Sort(bad)
	return bad
}
