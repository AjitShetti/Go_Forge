package main

import "testing"

func deepCopy(g [][]int) [][]int {
	out := make([][]int, len(g))
	for i := range g {
		out[i] = append([]int(nil), g[i]...)
	}
	return out
}

func sameValues(a, b [][]int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if len(a[i]) != len(b[i]) {
			return false
		}
		for j := range a[i] {
			if a[i][j] != b[i][j] {
				return false
			}
		}
	}
	return true
}

func TestClone(t *testing.T) {
	cases := []struct {
		name string
		grid [][]int
	}{
		{"nil", nil},
		{"empty rows", [][]int{{}, {}}},
		{"square", [][]int{{1, 2}, {3, 4}}},
		{"ragged", [][]int{{1}, {2, 3, 4}, {}}},
		{"spare capacity", [][]int{append(make([]int, 0, 8), 5, 6)}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			before := deepCopy(c.grid)
			got := Clone(c.grid)
			if !sameValues(got, before) {
				t.Fatalf("Clone(%v) = %v", before, got)
			}
			for i := range got {
				for j := range got[i] {
					got[i][j] = -1
				}
			}
			if !sameValues(c.grid, before) {
				t.Fatalf("writing to the clone changed the original: %v became %v", before, c.grid)
			}
		})
	}
}
