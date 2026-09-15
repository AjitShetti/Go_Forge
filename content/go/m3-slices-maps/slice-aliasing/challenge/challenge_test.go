package main

import (
	"slices"
	"testing"
)

func TestAppendCopy(t *testing.T) {
	cases := []struct {
		name string
		s    []int
		v    int
		want []int
	}{
		{"nil slice", nil, 1, []int{1}},
		{"empty with spare capacity", make([]int, 0, 8), 7, []int{7}},
		{"full slice", []int{1, 2, 3}, 4, []int{1, 2, 3, 4}},
		{"spare capacity", append(make([]int, 0, 10), 1, 2), 3, []int{1, 2, 3}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			before := slices.Clone(tc.s)
			got := appendCopy(tc.s, tc.v)
			if !slices.Equal(got, tc.want) {
				t.Fatalf("appendCopy(%v, %d) = %v, want %v", before, tc.v, got, tc.want)
			}
			if !slices.Equal(tc.s, before) {
				t.Fatalf("input changed from %v to %v", before, tc.s)
			}
			// Nothing may have been written into s's spare capacity.
			if spare := tc.s[len(tc.s):cap(tc.s)]; len(spare) > 0 && spare[0] != 0 {
				t.Fatalf("wrote %d into the input's spare capacity", spare[0])
			}
			// Writes to the result must not show through the input.
			if len(tc.s) > 0 {
				got[0] = -1
				if tc.s[0] == -1 {
					t.Fatalf("result shares its backing array with the input")
				}
			}
		})
	}
}

func TestAppendCopyTwiceDoesNotCollide(t *testing.T) {
	base := make([]int, 3, 4)
	b := appendCopy(base, 99)
	c := appendCopy(base, 42)
	if b[3] != 99 || c[3] != 42 {
		t.Fatalf("b[3], c[3] = %d, %d; want 99, 42", b[3], c[3])
	}
}
