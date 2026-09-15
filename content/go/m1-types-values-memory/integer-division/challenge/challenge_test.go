package main

import "testing"

func TestFloorDiv(t *testing.T) {
	cases := []struct {
		name       string
		a, b, want int
	}{
		{"positive", 7, 2, 3},
		{"negative dividend", -7, 2, -4},
		{"negative divisor", 7, -2, -4},
		{"both negative", -7, -2, 3},
		{"exact negative", -6, 3, -2},
		{"exact positive", 6, 3, 2},
		{"zero dividend", 0, -5, 0},
		{"smaller than divisor", -1, 10, -1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := FloorDiv(c.a, c.b); got != c.want {
				t.Errorf("FloorDiv(%d, %d) = %d, want %d", c.a, c.b, got, c.want)
			}
		})
	}
}

func TestFloorMod(t *testing.T) {
	cases := []struct {
		name       string
		a, b, want int
	}{
		{"positive", 7, 2, 1},
		{"negative dividend", -7, 2, 1},
		{"negative divisor", 7, -2, -1},
		{"both negative", -7, -2, -1},
		{"exact", -6, 3, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := FloorMod(c.a, c.b); got != c.want {
				t.Errorf("FloorMod(%d, %d) = %d, want %d", c.a, c.b, got, c.want)
			}
		})
	}
}
