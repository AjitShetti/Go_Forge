package main

import (
	"fmt"
	"maps"
	"slices"
	"sort"
)

func main() {
	xs := []int{3, 1, 2}
	slices.Sort(xs)
	fmt.Println(xs, slices.Contains(xs, 2), slices.Index(xs, 3))
	m := map[string]int{"b": 2, "a": 1, "c": 3}
	keys := slices.Collect(maps.Keys(m))
	sort.Strings(keys)
	fmt.Println(keys)
}
