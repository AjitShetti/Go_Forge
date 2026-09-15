package main

import (
	"slices"
	"testing"
)

func TestFields(t *testing.T) {
	cases := []struct {
		name string
		s    string
		want []string
	}{
		{"one word", "go", []string{"go"}},
		{"two words", "hello world", []string{"hello", "world"}},
		{"runs of spaces", "  a   b  ", []string{"a", "b"}},
		{"empty", "", nil},
		{"only spaces", "    ", nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Fields(nil, c.s); !slices.Equal(got, c.want) {
				t.Errorf("Fields(nil, %q) = %q, want %q", c.s, got, c.want)
			}
		})
	}
}

func TestFieldsKeepsDst(t *testing.T) {
	got := Fields([]string{"x"}, "y z")
	if want := []string{"x", "y", "z"}; !slices.Equal(got, want) {
		t.Errorf("Fields([x], %q) = %q, want %q", "y z", got, want)
	}
}

func TestFieldsDoesNotAllocate(t *testing.T) {
	dst := make([]string, 0, 16)
	allocs := testing.AllocsPerRun(100, func() {
		dst = Fields(dst[:0], "the quick  brown fox")
	})
	if allocs != 0 {
		t.Errorf("Fields allocated %v times per call with spare capacity in dst, want 0", allocs)
	}
}
