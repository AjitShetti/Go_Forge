package main

import (
	"fmt"
	"reflect"
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
	if !reflect.DeepEqual(got, want) {
		return fmt.Sprintf("FAIL %s = %v, want %v", name, got, want)
	}
	return "ok   " + name
}

func fields(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, ",")
}
