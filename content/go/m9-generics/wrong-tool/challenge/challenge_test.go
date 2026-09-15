package main

import (
	"fmt"
	"slices"
	"testing"
)

type UserCreated struct{ Name string }
type OrderPlaced struct{ ID int }
type Refund struct{ OrderID int }

func TestRouter(t *testing.T) {
	newRouter := func() *Router {
		r := NewRouter()
		Register(r, func(e UserCreated) string { return "welcome " + e.Name })
		Register(r, func(e OrderPlaced) string { return fmt.Sprintf("ship order %d", e.ID) })
		return r
	}

	t.Run("routes by type", func(t *testing.T) {
		got := newRouter().Dispatch([]any{OrderPlaced{7}, UserCreated{"ana"}, OrderPlaced{8}})
		want := []string{"ship order 7", "welcome ana", "ship order 8"}
		if !slices.Equal(got, want) {
			t.Fatalf("Dispatch = %q, want %q", got, want)
		}
	})
	t.Run("unhandled events", func(t *testing.T) {
		got := newRouter().Dispatch([]any{Refund{7}, 42, nil})
		want := []string{"unhandled main.Refund", "unhandled int", "unhandled <nil>"}
		if !slices.Equal(got, want) {
			t.Fatalf("Dispatch = %q, want %q", got, want)
		}
	})
	t.Run("a pointer is a different type", func(t *testing.T) {
		got := newRouter().Dispatch([]any{&OrderPlaced{9}})
		if !slices.Equal(got, []string{"unhandled *main.OrderPlaced"}) {
			t.Fatalf("Dispatch = %q", got)
		}
	})
	t.Run("registering again replaces", func(t *testing.T) {
		r := newRouter()
		Register(r, func(e UserCreated) string { return "hi again " + e.Name })
		if got := r.Dispatch([]any{UserCreated{"bo"}}); !slices.Equal(got, []string{"hi again bo"}) {
			t.Fatalf("Dispatch = %q", got)
		}
	})
	t.Run("no handlers", func(t *testing.T) {
		if got := NewRouter().Dispatch([]any{UserCreated{"x"}}); !slices.Equal(got, []string{"unhandled main.UserCreated"}) {
			t.Fatalf("Dispatch = %q", got)
		}
	})
}
