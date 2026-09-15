package main

import (
	"fmt"
	"slices"
	"testing"
)

func TestChunkValues(t *testing.T) {
	cases := []struct {
		name string
		xs   []int
		size int
		want [][]int
	}{
		{"even", []int{1, 2, 3, 4, 5, 6}, 2, [][]int{{1, 2}, {3, 4}, {5, 6}}},
		{"remainder", []int{1, 2, 3, 4, 5}, 2, [][]int{{1, 2}, {3, 4}, {5}}},
		{"size bigger than input", []int{1, 2}, 5, [][]int{{1, 2}}},
		{"size one", []int{7, 8}, 1, [][]int{{7}, {8}}},
		{"empty", nil, 3, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := Chunk(c.xs, c.size)
			if fmt.Sprint(got) != fmt.Sprint(c.want) {
				t.Errorf("Chunk(%v, %d) = %v, want %v", c.xs, c.size, got, c.want)
			}
		})
	}
}

func TestChunkWritesDoNotLeak(t *testing.T) {
	xs := []int{1, 2, 3, 4}
	chunks := Chunk(xs, 2)
	chunks[0][0] = 100
	chunks[1][1] = 400
	if want := []int{1, 2, 3, 4}; !slices.Equal(xs, want) {
		t.Errorf("writing to chunks changed xs to %v", xs)
	}
}

func TestChunkAppendsDoNotLeak(t *testing.T) {
	xs := []int{1, 2, 3, 4}
	chunks := Chunk(xs, 2)
	chunks[0] = append(chunks[0], 99)
	if want := []int{1, 2, 3, 4}; !slices.Equal(xs, want) {
		t.Errorf("appending to the first chunk changed xs to %v", xs)
	}
	if want := []int{3, 4}; !slices.Equal(chunks[1], want) {
		t.Errorf("appending to the first chunk changed the second chunk to %v", chunks[1])
	}
}
