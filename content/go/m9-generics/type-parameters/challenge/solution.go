package main

import (
	"cmp"
	"slices"
)

// GroupBy splits xs into groups by key(x). Each group keeps its elements in
// their original order. It must work for any element type and any comparable
// key type.
//
// K only needs == (it's a map key), so comparable is the right constraint.
func GroupBy[T any, K comparable](xs []T, key func(T) K) map[K][]T {
	groups := map[K][]T{}
	for _, x := range xs {
		k := key(x)
		groups[k] = append(groups[k], x)
	}
	return groups
}

// SortedKeys returns m's keys in ascending order. It must work for any map
// whose keys can be ordered with <, including named types such as
// `type CustomerID string`.
//
// cmp.Ordered is ~int | ~int8 | ... | ~float64 | ~string. The ~ admits named
// types whose underlying type is in the list.
func SortedKeys[K cmp.Ordered, V any](m map[K]V) []K {
	keys := make([]K, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}
