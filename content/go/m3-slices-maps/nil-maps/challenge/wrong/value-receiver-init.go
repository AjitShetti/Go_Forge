package main

type Index struct {
	lines map[string][]int
}

// Creates the map, but in a copy of the Index: the caller's field stays nil.
func (ix Index) Add(word string, line int) {
	if ix.lines == nil {
		ix.lines = make(map[string][]int)
	}
	ix.lines[word] = append(ix.lines[word], line)
}

func (ix Index) Lines(word string) []int {
	return ix.lines[word]
}
