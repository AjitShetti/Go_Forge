package main

import "testing"

func TestExplain(t *testing.T) {
	cases := []struct {
		name      string
		got, want []string
		msg       string
	}{
		{"equal", []string{"a", "b"}, []string{"a", "b"}, ""},
		{"nil and empty match", nil, []string{}, ""},
		{"both nil", nil, nil, ""},
		{"trailing space", []string{"a", "b "}, []string{"a", "b"}, `element 1: got "b ", want "b"`},
		{"empty string element", []string{""}, []string{"x"}, `element 0: got "", want "x"`},
		{"first of several differences", []string{"x", "y", "z"}, []string{"x", "q", "w"}, `element 1: got "y", want "q"`},
		{"too short", []string{"a"}, []string{"a", "b"}, `got 1 elements, want 2: ["a"] vs ["a" "b"]`},
		{"nil against one element", nil, []string{"x"}, `got 0 elements, want 1: [] vs ["x"]`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if msg := Explain(c.got, c.want); msg != c.msg {
				t.Errorf("Explain(%#v, %#v)\n got: %q\nwant: %q", c.got, c.want, msg, c.msg)
			}
		})
	}
}
