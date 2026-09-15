package main

import (
	"fmt"
	"strings"
	"testing"
)

var words = []string{"alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"}

func concat() string {
	s := ""
	for _, w := range words {
		s += w + ","
	}
	return s
}

func build() string {
	var b strings.Builder
	for _, w := range words {
		b.WriteString(w)
		b.WriteByte(',')
	}
	return b.String()
}

func buildGrown() string {
	var b strings.Builder
	b.Grow(64)
	for _, w := range words {
		b.WriteString(w)
		b.WriteByte(',')
	}
	return b.String()
}

var sink string

func main() {
	fmt.Println(testing.AllocsPerRun(100, func() { sink = concat() }))
	fmt.Println(testing.AllocsPerRun(100, func() { sink = build() }))
	fmt.Println(testing.AllocsPerRun(100, func() { sink = buildGrown() }))
}
