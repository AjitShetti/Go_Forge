package main

import (
	"slices"
	"testing"
)

func TestIndex(t *testing.T) {
	t.Run("empty index", func(t *testing.T) {
		var ix Index
		if got := ix.Lines("go"); len(got) != 0 {
			t.Fatalf("Lines on an empty Index = %v, want none", got)
		}
	})
	t.Run("zero value accepts writes", func(t *testing.T) {
		var ix Index
		ix.Add("go", 1)
		if got := ix.Lines("go"); !slices.Equal(got, []int{1}) {
			t.Fatalf("Lines(go) = %v, want [1]", got)
		}
	})
	t.Run("keeps every word", func(t *testing.T) {
		var ix Index
		ix.Add("go", 1)
		ix.Add("rust", 2)
		ix.Add("go", 3)
		if got := ix.Lines("go"); !slices.Equal(got, []int{1, 3}) {
			t.Errorf("Lines(go) = %v, want [1 3]", got)
		}
		if got := ix.Lines("rust"); !slices.Equal(got, []int{2}) {
			t.Errorf("Lines(rust) = %v, want [2]", got)
		}
	})
	t.Run("missing word", func(t *testing.T) {
		var ix Index
		ix.Add("go", 1)
		if got := ix.Lines("python"); len(got) != 0 {
			t.Errorf("Lines(python) = %v, want none", got)
		}
	})
	t.Run("as a struct field", func(t *testing.T) {
		var doc struct {
			title string
			words Index
		}
		doc.words.Add("map", 7)
		if got := doc.words.Lines("map"); !slices.Equal(got, []int{7}) {
			t.Errorf("Lines(map) = %v, want [7]", got)
		}
	})
}
