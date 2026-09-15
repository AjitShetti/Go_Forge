package main

import (
	"slices"
	"testing"
)

func TestTopN(t *testing.T) {
	scores := map[string]int{"ana": 30, "bo": 50, "cy": 40, "di": 40, "ed": 10}
	cases := []struct {
		name   string
		scores map[string]int
		n      int
		want   []string
	}{
		{"top one", scores, 1, []string{"bo"}},
		{"tie broken by name", scores, 3, []string{"bo", "cy", "di"}},
		{"everyone", scores, 5, []string{"bo", "cy", "di", "ana", "ed"}},
		{"n larger than players", map[string]int{"x": 1, "y": 2}, 10, []string{"y", "x"}},
		{"zero", scores, 0, []string{}},
		{"nil map", nil, 3, []string{}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			// Call it several times: map iteration order changes between
			// loops, and the answer must not.
			for i := 0; i < 20; i++ {
				if got := TopN(c.scores, c.n); !slices.Equal(got, c.want) {
					t.Fatalf("call %d: TopN(%v, %d) = %q, want %q", i+1, c.scores, c.n, got, c.want)
				}
			}
		})
	}
}
