package main

import (
	"cmp"
	"maps"
	"slices"
)

// Deterministic, but breaks ties by name in reverse.
func TopN(scores map[string]int, n int) []string {
	names := slices.Collect(maps.Keys(scores))
	slices.SortFunc(names, func(a, b string) int {
		if c := cmp.Compare(scores[b], scores[a]); c != 0 {
			return c
		}
		return cmp.Compare(b, a)
	})
	return names[:min(n, len(names))]
}
