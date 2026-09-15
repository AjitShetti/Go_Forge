package main

import (
	"math"
	"testing"
)

func TestMulInt32(t *testing.T) {
	cases := []struct {
		name   string
		a, b   int32
		want   int32
		wantOK bool
	}{
		{"small", 2, 3, 6, true},
		{"negative", -4, 5, -20, true},
		{"zero times min", 0, math.MinInt32, 0, true},
		{"by zero", 7, 0, 0, true},
		{"just fits", 46340, 46340, 2147395600, true},
		{"just overflows", 46341, 46341, 0, false},
		{"exactly min", -65536, 32768, math.MinInt32, true},
		{"one past max", 65536, 32768, 0, false},
		{"max times two", math.MaxInt32, 2, 0, false},
		{"min times minus one", math.MinInt32, -1, 0, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := MulInt32(c.a, c.b)
			if got != c.want || ok != c.wantOK {
				t.Errorf("MulInt32(%d, %d) = %d, %v; want %d, %v", c.a, c.b, got, ok, c.want, c.wantOK)
			}
		})
	}
}
