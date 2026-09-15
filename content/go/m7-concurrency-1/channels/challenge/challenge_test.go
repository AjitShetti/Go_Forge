package main

import (
	"runtime"
	"sync"
	"testing"
	"time"
)

// after returns a fn that sleeps for ms milliseconds, returns name, and marks
// itself finished in wg.
func after(ms int, name string, wg *sync.WaitGroup) func() string {
	wg.Add(1)
	return func() string {
		defer wg.Done()
		time.Sleep(time.Duration(ms) * time.Millisecond)
		return name
	}
}

// waitAll waits for every fn to return, but gives up after a second, so an
// implementation that never calls some fns fails instead of hanging.
func waitAll(t *testing.T, wg *sync.WaitGroup) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("some fns were never called: First must start all of them")
	}
}

func TestFirst(t *testing.T) {
	t.Run("one fn", func(t *testing.T) {
		var wg sync.WaitGroup
		if got := First(after(1, "only", &wg)); got != "only" {
			t.Fatalf("First = %q, want \"only\"", got)
		}
		waitAll(t, &wg)
	})
	t.Run("fastest wins", func(t *testing.T) {
		var wg sync.WaitGroup
		got := First(after(90, "slow", &wg), after(10, "fast", &wg), after(50, "medium", &wg))
		if got != "fast" {
			t.Fatalf("First = %q, want \"fast\"", got)
		}
		waitAll(t, &wg)
	})
	t.Run("does not wait for the slow ones", func(t *testing.T) {
		var wg sync.WaitGroup
		start := time.Now()
		First(after(400, "slow", &wg), after(10, "fast", &wg))
		if d := time.Since(start); d > 200*time.Millisecond {
			t.Fatalf("First took %v; it waited for the slow fn", d.Round(10*time.Millisecond))
		}
		waitAll(t, &wg)
	})
	t.Run("no goroutine is left blocked", func(t *testing.T) {
		time.Sleep(20 * time.Millisecond) // settle: earlier cases' goroutines finish exiting
		before := runtime.NumGoroutine()
		var wg sync.WaitGroup
		First(after(10, "a", &wg), after(20, "b", &wg), after(30, "c", &wg), after(40, "d", &wg))
		waitAll(t, &wg)                   // every fn has returned...
		time.Sleep(50 * time.Millisecond) // ...and their goroutines had time to send and exit
		if leaked := runtime.NumGoroutine() - before; leaked > 0 {
			t.Fatalf("%d goroutine(s) still running after every fn returned: they're stuck sending", leaked)
		}
	})
}
