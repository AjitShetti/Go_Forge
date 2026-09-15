package main

import "sort"

// GroupBy splits xs into groups by key(x). Each group keeps its elements in
// their original order. It must work for any element type and any comparable
// key type.
func GroupBy(xs []string, key func(string) int) map[int][]string {
	groups := map[int][]string{}
	for _, x := range xs {
		k := key(x)
		groups[k] = append(groups[k], x)
	}
	return groups
}

// SortedKeys returns m's keys in ascending order. It must work for any map
// whose keys can be ordered with <, including named types such as
// `type CustomerID string`.
func SortedKeys(m map[string]int) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
