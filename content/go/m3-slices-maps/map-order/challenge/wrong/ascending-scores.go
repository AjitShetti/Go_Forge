package main

import (
	"cmp"
	"maps"
	"slices"
)

// Sorts lowest score first.
func TopN(scores map[string]int, n int) []string {
	names := slices.Collect(maps.Keys(scores))
	slices.SortFunc(names, func(a, b string) int {
		if c := cmp.Compare(scores[a], scores[b]); c != 0 {
			return c
		}
		return cmp.Compare(a, b)
	})
	return names[:min(n, len(names))]
}
