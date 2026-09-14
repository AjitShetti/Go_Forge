package main

import "fmt"

type Stack[T any] struct {
	items []T
}

func (s *Stack[T]) Push(v T) { s.items = append(s.items, v) }

func (s *Stack[T]) Pop() (T, bool) {
	var zero T
	if len(s.items) == 0 {
		return zero, false
	}
	v := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return v, true
}

func Index[T comparable](xs []T, want T) int {
	for i, x := range xs {
		if x == want {
			return i
		}
	}
	return -1
}

type Pair[K comparable, V any] struct {
	Key K
	Val V
}

func main() {
	var s Stack[string]
	s.Push("a")
	s.Push("b")
	v, ok := s.Pop()
	fmt.Println(v, ok)
	fmt.Println(Index([]string{"x", "y", "z"}, "z"))
	p := Pair[string, int]{"age", 30}
	fmt.Printf("%+v\n", p)
}
