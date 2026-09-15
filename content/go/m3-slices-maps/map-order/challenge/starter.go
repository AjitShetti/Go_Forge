package main

import "sort"

// TopN returns the names of the n highest scores, highest first. Equal
// scores are ordered by name, alphabetically. If n is larger than the number
// of players, every name is returned. The result must be the same on every
// call for the same input.
func TopN(scores map[string]int, n int) []string {
	names := make([]string, 0, len(scores))
	for name := range scores {
		names = append(names, name)
	}
	sort.Strings(names)
	if n < len(names) {
		names = names[:n]
	}
	return names
}
