package main

import (
	"fmt"
	"reflect"
	"strings"
)

func fields(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, ",")
}

func main() {
	cases := []struct {
		in   string
		want []string
	}{
		{"a,b", []string{"a", "b"}},
		{"", []string{}},
	}
	for _, c := range cases {
		got := fields(c.in)
		if !reflect.DeepEqual(got, c.want) {
			fmt.Printf("FAIL fields(%q) = %v, want %v\n", c.in, got, c.want)
		} else {
			fmt.Printf("ok   fields(%q)\n", c.in)
		}
	}
}
