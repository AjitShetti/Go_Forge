package main

import (
	"fmt"
	"slices"
	"strings"
)

func main() {
	cases := []struct {
		in   string
		want []string
	}{
		{"a,b", []string{"a", "b"}},
		{"", []string{}},
		{"x", []string{"x"}},
	}
	for _, c := range cases {
		fmt.Println(check(fmt.Sprintf("fields(%q)", c.in), fields(c.in), c.want))
	}
}

// check returns "ok   <name>" when got matches want, and a FAIL line
// otherwise. For fields, a nil result and an empty one mean the same thing.
func check(name string, got, want []string) string {
	// slices.Equal compares length and elements, so nil and []string{} are
	// equal. %q makes whitespace and empty strings visible in the message.
	if !slices.Equal(got, want) {
		return fmt.Sprintf("FAIL %s = %q, want %q", name, got, want)
	}
	return "ok   " + name
}

func fields(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, ",")
}
