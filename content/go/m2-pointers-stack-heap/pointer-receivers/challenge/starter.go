package main

// Stack is a last-in, first-out stack of ints. Its zero value is an empty
// stack ready to use.
type Stack struct {
	items []int
}

// Push adds v to the top.
func (s Stack) Push(v int) {
	s.items = append(s.items, v)
}

// Pop removes and returns the top value, or 0 and false if s is empty.
func (s Stack) Pop() (int, bool) {
	if len(s.items) == 0 {
		return 0, false
	}
	v := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return v, true
}

// Len reports how many values are on the stack.
func (s Stack) Len() int {
	return len(s.items)
}
