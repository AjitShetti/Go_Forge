package main

import "cmp"

// Generic signatures are right, but the keys come back in map iteration
// order, which Go randomizes.
func GroupBy[T any, K comparable](xs []T, key func(T) K) map[K][]T {
	groups := map[K][]T{}
	for _, x := range xs {
		k := key(x)
		groups[k] = append(groups[k], x)
	}
	return groups
}

func SortedKeys[K cmp.Ordered, V any](m map[K]V) []K {
	keys := make([]K, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
