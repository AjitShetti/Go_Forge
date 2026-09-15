package main

import (
	"fmt"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// meter wraps a slow work function and records the most calls that were ever
// running at once.
type meter struct {
	running, peak atomic.Int32
}

func (m *meter) work(delay func(string) time.Duration) func(string) string {
	return func(s string) string {
		n := m.running.Add(1)
		for {
			p := m.peak.Load()
			if n <= p || m.peak.CompareAndSwap(p, n) {
				break
			}
		}
		time.Sleep(delay(s))
		m.running.Add(-1)
		return strings.ToUpper(s)
	}
}

func items(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = fmt.Sprintf("img%02d", i)
	}
	return out
}

func constant(d time.Duration) func(string) time.Duration {
	return func(string) time.Duration { return d }
}

func TestProcessAll(t *testing.T) {
	t.Run("no items", func(t *testing.T) {
		var m meter
		if got := ProcessAll(nil, 3, m.work(constant(0))); len(got) != 0 {
			t.Fatalf("ProcessAll(nil) = %v", got)
		}
	})
	t.Run("results in input order", func(t *testing.T) {
		var m meter
		// Earlier items are slower, so they finish last.
		in := []string{"a", "b", "c", "d", "e"}
		delay := func(s string) time.Duration { return time.Duration('f'-s[0]) * 15 * time.Millisecond }
		got := ProcessAll(in, 5, m.work(delay))
		if want := []string{"A", "B", "C", "D", "E"}; !slices.Equal(got, want) {
			t.Fatalf("ProcessAll = %v, want %v", got, want)
		}
	})
	t.Run("never more than limit at once", func(t *testing.T) {
		var m meter
		ProcessAll(items(20), 3, m.work(constant(20*time.Millisecond)))
		if p := m.peak.Load(); p > 3 {
			t.Fatalf("%d calls ran at the same time, limit is 3", p)
		}
	})
	t.Run("uses the limit", func(t *testing.T) {
		var m meter
		start := time.Now()
		got := ProcessAll(items(12), 4, m.work(constant(50*time.Millisecond)))
		d := time.Since(start)
		if len(got) != 12 {
			t.Fatalf("got %d results, want 12", len(got))
		}
		if d > 400*time.Millisecond {
			t.Fatalf("12 items of 50ms with limit 4 took %v, want about 150ms", d.Round(10*time.Millisecond))
		}
		if p := m.peak.Load(); p < 4 {
			t.Fatalf("at most %d calls ran at once, the limit of 4 was never used", p)
		}
	})
	t.Run("limit larger than the work", func(t *testing.T) {
		var m meter
		delay := func(s string) time.Duration {
			if s == "x" {
				return 30 * time.Millisecond
			}
			return time.Millisecond
		}
		got := ProcessAll([]string{"x", "y"}, 10, m.work(delay))
		if !slices.Equal(got, []string{"X", "Y"}) {
			t.Fatalf("ProcessAll = %v, want [X Y]", got)
		}
	})
}
