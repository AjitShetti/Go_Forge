package main

import (
	"context"
	"errors"
	"slices"
	"sync/atomic"
	"testing"
	"time"
)

var errBoom = errors.New("boom")

// fakeWeb serves urls after a delay, fails the ones in fail, and honors ctx.
// A fetch that sees ctx cancelled takes 20ms to clean up before returning.
type fakeWeb struct {
	delay     map[string]time.Duration
	fail      map[string]error
	inFlight  atomic.Int32
	cancelled atomic.Int32
}

func (w *fakeWeb) fetch(ctx context.Context, url string) (string, error) {
	w.inFlight.Add(1)
	defer w.inFlight.Add(-1)
	select {
	case <-time.After(w.delay[url]):
		if err := w.fail[url]; err != nil {
			return "", err
		}
		return "body of " + url, nil
	case <-ctx.Done():
		w.cancelled.Add(1)
		time.Sleep(20 * time.Millisecond)
		return "", ctx.Err()
	}
}

const ms = time.Millisecond

func TestFetchAll(t *testing.T) {
	t.Run("all succeed, in order", func(t *testing.T) {
		w := &fakeWeb{delay: map[string]time.Duration{"a": 60 * ms, "b": 10 * ms, "c": 30 * ms}}
		got, err := FetchAll(context.Background(), []string{"a", "b", "c"}, w.fetch)
		want := []string{"body of a", "body of b", "body of c"}
		if err != nil || !slices.Equal(got, want) {
			t.Fatalf("FetchAll = %q, %v; want %q, nil", got, err, want)
		}
	})
	t.Run("concurrent", func(t *testing.T) {
		w := &fakeWeb{delay: map[string]time.Duration{"a": 100 * ms, "b": 100 * ms, "c": 100 * ms, "d": 100 * ms}}
		start := time.Now()
		FetchAll(context.Background(), []string{"a", "b", "c", "d"}, w.fetch)
		if d := time.Since(start); d > 300*ms {
			t.Fatalf("four 100ms fetches took %v: they ran one after another", d.Round(10*ms))
		}
	})
	t.Run("first error cancels the rest", func(t *testing.T) {
		w := &fakeWeb{
			delay: map[string]time.Duration{"ok": 10 * ms, "bad": 30 * ms, "slow1": time.Second, "slow2": time.Second},
			fail:  map[string]error{"bad": errBoom},
		}
		start := time.Now()
		_, err := FetchAll(context.Background(), []string{"ok", "bad", "slow1", "slow2"}, w.fetch)
		if !errors.Is(err, errBoom) {
			t.Fatalf("err = %v, want boom", err)
		}
		if d := time.Since(start); d > 400*ms {
			t.Fatalf("FetchAll took %v after a fetch failed at 30ms: the slow fetches weren't cancelled", d.Round(10*ms))
		}
		time.Sleep(50 * ms) // let any fetch that was told to stop finish noticing
		if n := w.cancelled.Load(); n != 2 {
			t.Fatalf("%d fetches saw cancellation, want 2 (slow1, slow2)", n)
		}
	})
	t.Run("nothing still running after return", func(t *testing.T) {
		w := &fakeWeb{
			delay: map[string]time.Duration{"bad": 10 * ms, "slow": time.Second},
			fail:  map[string]error{"bad": errBoom},
		}
		FetchAll(context.Background(), []string{"bad", "slow"}, w.fetch)
		if n := w.inFlight.Load(); n != 0 {
			t.Fatalf("FetchAll returned while %d fetch(es) were still running", n)
		}
	})
	t.Run("caller's timeout", func(t *testing.T) {
		w := &fakeWeb{delay: map[string]time.Duration{"a": time.Second, "b": time.Second}}
		ctx, cancel := context.WithTimeout(context.Background(), 50*ms)
		defer cancel()
		start := time.Now()
		_, err := FetchAll(ctx, []string{"a", "b"}, w.fetch)
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("err = %v, want context.DeadlineExceeded", err)
		}
		if d := time.Since(start); d > 400*ms {
			t.Fatalf("FetchAll took %v with a 50ms timeout", d.Round(10*ms))
		}
	})
}
