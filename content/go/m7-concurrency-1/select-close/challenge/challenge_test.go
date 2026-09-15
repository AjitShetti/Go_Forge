package main

import (
	"slices"
	"testing"
	"time"
)

type send struct {
	at    time.Duration // after the feed starts
	value int
}

// feed sends each value at its time on an unbuffered channel, then closes the
// channel if closeAfter is true. A value that isn't received stays blocked,
// like a real producer.
func feed(sends []send, closeAfter bool) <-chan int {
	ch := make(chan int)
	go func() {
		start := time.Now()
		for _, s := range sends {
			time.Sleep(s.at - time.Since(start))
			ch <- s.value
		}
		if closeAfter {
			close(ch)
		}
	}()
	return ch
}

const ms = time.Millisecond

func TestMerge(t *testing.T) {
	t.Run("both already closed", func(t *testing.T) {
		start := time.Now()
		got := Merge(feed(nil, true), feed(nil, true), 5*time.Second)
		if len(got) != 0 || time.Since(start) > time.Second {
			t.Fatalf("Merge = %v after %v, want [] right away", got, time.Since(start).Round(ms))
		}
	})
	t.Run("values in arrival order", func(t *testing.T) {
		a := feed([]send{{0, 1}, {60 * ms, 3}}, true)
		b := feed([]send{{30 * ms, 2}, {90 * ms, 4}}, true)
		if got := Merge(a, b, 5*time.Second); !slices.Equal(got, []int{1, 2, 3, 4}) {
			t.Fatalf("Merge = %v, want [1 2 3 4]", got)
		}
	})
	t.Run("keeps reading after one side closes", func(t *testing.T) {
		a := feed(nil, true)
		b := feed([]send{{20 * ms, 5}, {50 * ms, 6}}, true)
		if got := Merge(a, b, 5*time.Second); !slices.Equal(got, []int{5, 6}) {
			t.Fatalf("Merge = %v, want [5 6]", got)
		}
	})
	t.Run("returns when both close, not at the timeout", func(t *testing.T) {
		start := time.Now()
		Merge(feed([]send{{10 * ms, 1}}, true), feed([]send{{20 * ms, 2}}, true), 5*time.Second)
		if d := time.Since(start); d > time.Second {
			t.Fatalf("Merge took %v; both channels were closed within 20ms", d.Round(ms))
		}
	})
	t.Run("timeout counts from the start", func(t *testing.T) {
		// a never closes and keeps sending every 70ms. With a 100ms timeout,
		// only the values sent at 10ms and 80ms are collected.
		a := feed([]send{{10 * ms, 7}, {80 * ms, 8}, {150 * ms, 9}, {220 * ms, 10}}, false)
		start := time.Now()
		got := Merge(a, feed(nil, true), 100*ms)
		if !slices.Equal(got, []int{7, 8}) {
			t.Fatalf("Merge = %v, want [7 8]", got)
		}
		if d := time.Since(start); d > 300*ms {
			t.Fatalf("Merge returned after %v, want about 100ms", d.Round(ms))
		}
	})
}
