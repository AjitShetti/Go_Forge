package main

import "testing"

func TestPort(t *testing.T) {
	cases := []struct {
		name string
		cfg  map[string]int
		want int
	}{
		{"nil config", nil, 8080},
		{"empty config", map[string]int{}, 8080},
		{"set", map[string]int{"port": 9000}, 9000},
		{"other keys only", map[string]int{"workers": 4}, 8080},
		{"explicit zero", map[string]int{"port": 0}, 0},
		{"explicit zero with others", map[string]int{"port": 0, "workers": 4}, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Port(c.cfg); got != c.want {
				t.Errorf("Port(%v) = %d, want %d", c.cfg, got, c.want)
			}
		})
	}
}
