package main

type Stack struct {
	items []int
}

func (s *Stack) Push(v int) {
	s.items = append(s.items, v)
}

// Returns the top value, but shrinks a copy of the header: nothing is removed.
func (s Stack) Pop() (int, bool) {
	if len(s.items) == 0 {
		return 0, false
	}
	v := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return v, true
}

func (s *Stack) Len() int {
	return len(s.items)
}
