package main

import (
	"fmt"
	"sort"
)

func main() {
	scores := map[string]int{"ana": 30, "bo": 50, "cy": 40}
	names := make([]string, 0, len(scores))
	for name := range scores {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		fmt.Println(name, scores[name])
	}
}
