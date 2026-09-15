package main

import (
	"cmp"
	"maps"
	"slices"
)

// TopN returns the names of the n highest scores, highest first. Equal
// scores are ordered by name, alphabetically. If n is larger than the number
// of players, every name is returned. The result must be the same on every
// call for the same input.
func TopN(scores map[string]int, n int) []string {
	// maps.Keys comes out in random order. The comparison below breaks every
	// tie, so the final order doesn't depend on it.
	names := slices.Collect(maps.Keys(scores))
	slices.SortFunc(names, func(a, b string) int {
		if c := cmp.Compare(scores[b], scores[a]); c != 0 {
			return c
		}
		return cmp.Compare(a, b)
	})
	return names[:min(n, len(names))]
}
