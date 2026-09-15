package main

import (
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestProfiles(t *testing.T) {
	t.Run("add and read", func(t *testing.T) {
		p := NewProfiles()
		if !p.AddTag("ana", "vip") || !p.AddTag("ana", "beta") {
			t.Fatal("first AddTag of a tag returned false")
		}
		if p.AddTag("ana", "vip") {
			t.Fatal("AddTag of an existing tag returned true")
		}
		if got := p.Tags("ana"); !slices.Equal(got, []string{"vip", "beta"}) {
			t.Fatalf("Tags(ana) = %q", got)
		}
		if got := p.Tags("bo"); len(got) != 0 {
			t.Fatalf("Tags of an unknown user = %q", got)
		}
	})
	t.Run("concurrent duplicates", func(t *testing.T) {
		p := NewProfiles()
		p.OnRead = func() { time.Sleep(time.Millisecond) }
		var added atomic.Int32
		var wg sync.WaitGroup
		for range 20 {
			wg.Go(func() {
				if p.AddTag("ana", "vip") {
					added.Add(1)
				}
			})
		}
		wg.Wait()
		if n := added.Load(); n != 1 {
			t.Fatalf("20 goroutines adding the same tag: %d reported adding it, want 1", n)
		}
		if got := p.Tags("ana"); !slices.Equal(got, []string{"vip"}) {
			t.Fatalf("Tags(ana) = %q, want [vip]", got)
		}
	})
	t.Run("caller's changes stay out", func(t *testing.T) {
		p := NewProfiles()
		p.AddTag("ana", "vip")
		p.AddTag("ana", "beta")
		got := p.Tags("ana")
		got[0] = "hacked"
		if again := p.Tags("ana"); !slices.Equal(again, []string{"vip", "beta"}) {
			t.Fatalf("after the caller changed its result, Tags(ana) = %q", again)
		}
	})
	t.Run("appending to a result doesn't add tags", func(t *testing.T) {
		p := NewProfiles()
		p.AddTag("bo", "a")
		p.AddTag("bo", "b")
		p.AddTag("bo", "c") // the stored slice now has spare capacity
		got := p.Tags("bo")
		_ = append(got[:2], "sneaky")
		if again := p.Tags("bo"); !slices.Equal(again, []string{"a", "b", "c"}) {
			t.Fatalf("after the caller appended to its result, Tags(bo) = %q", again)
		}
	})
}
