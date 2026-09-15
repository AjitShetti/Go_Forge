package main

type Index struct {
	lines map[string][]int
}

// Never panics, but replaces the whole map on every call.
func (ix *Index) Add(word string, line int) {
	ix.lines = map[string][]int{word: append(ix.lines[word], line)}
}

func (ix *Index) Lines(word string) []int {
	return ix.lines[word]
}
