package main

import "testing"

func TestStack(t *testing.T) {
	t.Run("pop on empty", func(t *testing.T) {
		var s Stack
		if v, ok := s.Pop(); v != 0 || ok {
			t.Fatalf("Pop() on empty stack = %d, %v; want 0, false", v, ok)
		}
	})
	t.Run("last in first out", func(t *testing.T) {
		var s Stack
		s.Push(1)
		s.Push(2)
		s.Push(3)
		for _, want := range []int{3, 2, 1} {
			if v, ok := s.Pop(); v != want || !ok {
				t.Fatalf("Pop() = %d, %v; want %d, true", v, ok, want)
			}
		}
	})
	t.Run("len follows push and pop", func(t *testing.T) {
		var s Stack
		s.Push(7)
		s.Push(8)
		if s.Len() != 2 {
			t.Fatalf("Len() after 2 pushes = %d, want 2", s.Len())
		}
		s.Pop()
		if s.Len() != 1 {
			t.Fatalf("Len() after a pop = %d, want 1", s.Len())
		}
	})
	t.Run("empty again after popping everything", func(t *testing.T) {
		var s Stack
		s.Push(1)
		s.Pop()
		if v, ok := s.Pop(); v != 0 || ok {
			t.Fatalf("second Pop() = %d, %v; want 0, false", v, ok)
		}
	})
	t.Run("stack as a struct field", func(t *testing.T) {
		var job struct{ pending Stack }
		job.pending.Push(42)
		if v, ok := job.pending.Pop(); v != 42 || !ok {
			t.Fatalf("Pop() = %d, %v; want 42, true", v, ok)
		}
	})
	t.Run("through a pointer", func(t *testing.T) {
		s := &Stack{}
		s.Push(5)
		if s.Len() != 1 {
			t.Fatalf("Len() = %d, want 1", s.Len())
		}
	})
}
