package main

import "testing"

func TestHandlers(t *testing.T) {
	t.Run("no labels", func(t *testing.T) {
		if hs := Handlers(nil); len(hs) != 0 {
			t.Fatalf("Handlers(nil) returned %d handlers", len(hs))
		}
	})
	t.Run("one handler per label, called later", func(t *testing.T) {
		hs := Handlers([]string{"save", "open", "quit"})
		want := []string{"0:save", "1:open", "2:quit"}
		if len(hs) != len(want) {
			t.Fatalf("got %d handlers, want %d", len(hs), len(want))
		}
		for i, h := range hs {
			if got := h(); got != want[i] {
				t.Errorf("handler %d returned %q, want %q", i, got, want[i])
			}
		}
	})
	t.Run("called in any order", func(t *testing.T) {
		hs := Handlers([]string{"a", "b"})
		if got := hs[1](); got != "1:b" {
			t.Errorf("hs[1]() = %q, want \"1:b\"", got)
		}
		if got := hs[0](); got != "0:a" {
			t.Errorf("hs[0]() = %q, want \"0:a\"", got)
		}
	})
	t.Run("caller changes labels afterwards", func(t *testing.T) {
		labels := []string{"red", "green"}
		hs := Handlers(labels)
		labels[0] = "CHANGED"
		if got := hs[0](); got != "0:red" {
			t.Errorf("after labels[0] changed, hs[0]() = %q, want \"0:red\"", got)
		}
	})
}
