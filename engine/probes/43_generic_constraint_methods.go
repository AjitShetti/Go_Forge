package main

import (
	"cmp"
	"fmt"
	"strconv"
)

type Stringish interface {
	~int
	String() string
}

type Code int

func (c Code) String() string { return "C" + strconv.Itoa(int(c)) }

func Join[T Stringish](xs []T) string {
	s := ""
	for _, x := range xs {
		s += x.String()
	}
	return s
}

func MaxOf[T cmp.Ordered](xs ...T) T {
	m := xs[0]
	for _, x := range xs[1:] {
		if x > m {
			m = x
		}
	}
	return m
}

func main() {
	fmt.Println(Join([]Code{1, 2}))
	fmt.Println(MaxOf(3, 9, 4), MaxOf("b", "a"))
}
