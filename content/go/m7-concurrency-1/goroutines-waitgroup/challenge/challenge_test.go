package main

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// slowSizes returns a size function that blocks until every expected call has
// started, or until patience runs out, in which case it records that the calls
// weren't concurrent. It sleeps a little before returning so late returns are
// visible.
func slowSizes(sizes map[string]int) (size func(string) int, sequential *atomic.Bool, finished *atomic.Int32) {
	var arrived sync.WaitGroup
	arrived.Add(len(sizes))
	all := make(chan struct{})
	go func() {
		arrived.Wait()
		close(all)
	}()
	sequential = new(atomic.Bool)
	finished = new(atomic.Int32)
	size = func(p string) int {
		arrived.Done()
		select {
		case <-all:
		case <-time.After(300 * time.Millisecond):
			sequential.Store(true)
		}
		time.Sleep(20 * time.Millisecond)
		finished.Add(1)
		return sizes[p]
	}
	return size, sequential, finished
}

func TestTotalSize(t *testing.T) {
	t.Run("no paths", func(t *testing.T) {
		if got := TotalSize(nil, func(string) int { return 1 }); got != 0 {
			t.Fatalf("TotalSize(nil) = %d, want 0", got)
		}
	})
	t.Run("sums every size", func(t *testing.T) {
		sizes := map[string]int{"a": 10, "b": 20, "c": 30, "d": 40}
		size, _, _ := slowSizes(sizes)
		if got := TotalSize([]string{"a", "b", "c", "d"}, size); got != 100 {
			t.Fatalf("TotalSize = %d, want 100", got)
		}
	})
	t.Run("waits for every call", func(t *testing.T) {
		sizes := map[string]int{"x": 1, "y": 2, "z": 3}
		size, _, finished := slowSizes(sizes)
		TotalSize([]string{"x", "y", "z"}, size)
		if n := finished.Load(); n != 3 {
			t.Fatalf("TotalSize returned while only %d of 3 calls had finished", n)
		}
	})
	t.Run("calls run concurrently", func(t *testing.T) {
		sizes := map[string]int{"p": 1, "q": 1, "r": 1, "s": 1, "t": 1}
		size, sequential, _ := slowSizes(sizes)
		TotalSize([]string{"p", "q", "r", "s", "t"}, size)
		if sequential.Load() {
			t.Fatal("a call waited 300ms without the others starting: the calls ran one at a time")
		}
	})
}
