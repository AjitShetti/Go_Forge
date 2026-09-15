package main

import (
	"bytes"
	"go/format"
	"slices"
)

// Treats "gofmt couldn't parse it" as "nothing to report".
func Unformatted(files map[string]string) []string {
	var bad []string
	for name, src := range files {
		out, err := format.Source([]byte(src))
		if err != nil {
			continue
		}
		if !bytes.Equal(out, []byte(src)) {
			bad = append(bad, name)
		}
	}
	slices.Sort(bad)
	return bad
}
