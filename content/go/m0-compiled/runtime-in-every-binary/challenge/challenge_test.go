package main

import "testing"

func TestAt(t *testing.T) {
	xs := []int{10, 20, 30}
	cases := []struct {
		name   string
		xs     []int
		i      int
		want   int
		wantOK bool
	}{
		{"first", xs, 0, 10, true},
		{"last", xs, 2, 30, true},
		{"minus one", xs, -1, 30, true},
		{"minus len", xs, -3, 10, true},
		{"too negative", xs, -4, 0, false},
		{"empty negative", nil, -1, 0, false},
		{"empty zero", nil, 0, 0, false},
		{"huge", xs, 1 << 40, 0, false},
		{"one past the end", xs, 3, 0, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := At(c.xs, c.i)
			if got != c.want || ok != c.wantOK {
				t.Errorf("At(%v, %d) = %d, %v; want %d, %v", c.xs, c.i, got, ok, c.want, c.wantOK)
			}
		})
	}
}
