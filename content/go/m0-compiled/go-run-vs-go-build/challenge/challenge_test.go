package main

import "testing"

func TestAverage(t *testing.T) {
	cases := []struct {
		name string
		in   []int64
		want float64
	}{
		{"empty", nil, 0},
		{"single", []int64{4}, 4},
		{"half", []int64{1, 2}, 1.5},
		{"negative half", []int64{-1, -2}, -1.5},
		{"thirds", []int64{1, 2, 2}, 5.0 / 3},
		{"large", []int64{1 << 40, 1 << 40}, 1 << 40},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Average(c.in); got != c.want {
				t.Errorf("Average(%v) = %v, want %v", c.in, got, c.want)
			}
		})
	}
}
