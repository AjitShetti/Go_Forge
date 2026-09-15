package main

// Index records the line numbers each word appears on. Its zero value is an
// empty index, ready to use without a constructor.
type Index struct {
	lines map[string][]int
}

// Add records that word appears on line.
func (ix *Index) Add(word string, line int) {
	ix.lines[word] = append(ix.lines[word], line)
}

// Lines returns the lines word appears on, in the order they were added.
// A word that was never added has no lines.
func (ix *Index) Lines(word string) []int {
	return ix.lines[word]
}
