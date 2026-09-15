package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// fakeClock is a clock the tests move by hand.
type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func newClock() *fakeClock { return &fakeClock{t: time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)} }

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

func TestStore(t *testing.T) {
	t.Run("set and get", func(t *testing.T) {
		s := NewStore(newClock().Now)
		s.Set("lang", "go", 0)
		if v, ok := s.Get("lang"); !ok || v != "go" {
			t.Fatalf("Get(lang) = %q, %v", v, ok)
		}
		if _, ok := s.Get("nope"); ok {
			t.Fatal("Get of a missing key returned ok")
		}
	})
	t.Run("expires exactly at its deadline, before any sweep", func(t *testing.T) {
		clock := newClock()
		s := NewStore(clock.Now)
		s.Set("session", "ana", 30*time.Second)
		clock.Advance(29 * time.Second)
		if _, ok := s.Get("session"); !ok {
			t.Fatal("expired 1s early")
		}
		clock.Advance(time.Second)
		if v, ok := s.Get("session"); ok {
			t.Fatalf("Get at the deadline = %q, true; want expired", v)
		}
	})
	t.Run("zero ttl never expires", func(t *testing.T) {
		clock := newClock()
		s := NewStore(clock.Now)
		s.Set("forever", "x", 0)
		clock.Advance(24 * 365 * time.Hour)
		if _, ok := s.Get("forever"); !ok {
			t.Fatal("a ttl-0 key expired")
		}
	})
	t.Run("set again replaces the expiry", func(t *testing.T) {
		clock := newClock()
		s := NewStore(clock.Now)
		s.Set("k", "old", 10*time.Second)
		clock.Advance(8 * time.Second)
		s.Set("k", "new", 10*time.Second)
		clock.Advance(8 * time.Second)
		if v, ok := s.Get("k"); !ok || v != "new" {
			t.Fatalf("Get(k) = %q, %v; want new, true", v, ok)
		}
	})
	t.Run("delete and sweep", func(t *testing.T) {
		clock := newClock()
		s := NewStore(clock.Now)
		s.Set("a", "1", time.Second)
		s.Set("b", "2", time.Second)
		s.Set("c", "3", time.Hour)
		s.Set("d", "4", 0)
		s.Delete("d")
		s.Delete("never-there")
		clock.Advance(2 * time.Second)
		if n := s.Sweep(); n != 2 {
			t.Fatalf("Sweep removed %d, want 2", n)
		}
		if n := s.Sweep(); n != 0 {
			t.Fatalf("second Sweep removed %d, want 0", n)
		}
		if _, ok := s.Get("c"); !ok {
			t.Fatal("Sweep removed an entry that hadn't expired")
		}
	})
}

func TestHandler(t *testing.T) {
	do := func(h http.Handler, method, target, body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(method, target, strings.NewReader(body)))
		return rec
	}
	t.Run("put, get, delete", func(t *testing.T) {
		h := NewStore(newClock().Now).Handler()
		if r := do(h, "PUT", "/kv/user", "ana"); r.Code != 204 {
			t.Fatalf("PUT = %d, want 204", r.Code)
		}
		if r := do(h, "GET", "/kv/user", ""); r.Code != 200 || r.Body.String() != "ana" {
			t.Fatalf("GET = %d %q", r.Code, r.Body.String())
		}
		if r := do(h, "DELETE", "/kv/user", ""); r.Code != 204 {
			t.Fatalf("DELETE = %d, want 204", r.Code)
		}
		if r := do(h, "GET", "/kv/user", ""); r.Code != 404 || r.Body.String() != "not found\n" {
			t.Fatalf("GET after DELETE = %d %q", r.Code, r.Body.String())
		}
	})
	t.Run("ttl from the query string", func(t *testing.T) {
		clock := newClock()
		h := NewStore(clock.Now).Handler()
		do(h, "PUT", "/kv/token?ttl=90s", "abc")
		clock.Advance(89 * time.Second)
		if r := do(h, "GET", "/kv/token", ""); r.Code != 200 {
			t.Fatalf("GET before expiry = %d", r.Code)
		}
		clock.Advance(time.Second)
		if r := do(h, "GET", "/kv/token", ""); r.Code != 404 {
			t.Fatalf("GET after expiry = %d, want 404", r.Code)
		}
	})
	t.Run("bad ttl is 400 and stores nothing", func(t *testing.T) {
		h := NewStore(newClock().Now).Handler()
		if r := do(h, "PUT", "/kv/x?ttl=soon", "v"); r.Code != 400 {
			t.Fatalf("PUT with ttl=soon = %d, want 400", r.Code)
		}
		if r := do(h, "GET", "/kv/x", ""); r.Code != 404 {
			t.Fatalf("GET after a rejected PUT = %d, want 404", r.Code)
		}
	})
}

func TestPool(t *testing.T) {
	t.Run("never more workers than asked", func(t *testing.T) {
		p := NewPool(3, 20)
		var running, peak atomic.Int32
		for range 12 {
			p.Submit(context.Background(), func() {
				n := running.Add(1)
				for {
					if old := peak.Load(); n <= old || peak.CompareAndSwap(old, n) {
						break
					}
				}
				time.Sleep(15 * time.Millisecond)
				running.Add(-1)
			})
		}
		time.Sleep(5 * time.Millisecond) // the workers have picked up their first jobs
		p.Shutdown(context.Background())
		if n := peak.Load(); n != 3 {
			t.Fatalf("peak concurrency %d, want 3", n)
		}
	})
	t.Run("shutdown runs everything already queued", func(t *testing.T) {
		p := NewPool(2, 10)
		var done atomic.Int32
		for range 6 {
			p.Submit(context.Background(), func() {
				time.Sleep(20 * time.Millisecond)
				done.Add(1)
			})
		}
		time.Sleep(5 * time.Millisecond) // the workers have picked up their first jobs
		if err := p.Shutdown(context.Background()); err != nil {
			t.Fatalf("Shutdown = %v", err)
		}
		if n := done.Load(); n != 6 {
			t.Fatalf("Shutdown returned with %d of 6 queued jobs done", n)
		}
	})
	t.Run("submit after shutdown", func(t *testing.T) {
		p := NewPool(1, 1)
		p.Shutdown(context.Background())
		ran := make(chan struct{}, 1)
		if err := p.Submit(context.Background(), func() { ran <- struct{}{} }); !errors.Is(err, ErrClosed) {
			t.Fatalf("Submit after Shutdown = %v, want ErrClosed", err)
		}
	})
	t.Run("submit waits for room, but not past its context", func(t *testing.T) {
		p := NewPool(1, 1)
		release := make(chan struct{})
		p.Submit(context.Background(), func() { <-release }) // the worker is busy
		p.Submit(context.Background(), func() {})            // the queue is full
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
		defer cancel()
		start := time.Now()
		err := p.Submit(ctx, func() {})
		if !errors.Is(err, context.DeadlineExceeded) || time.Since(start) > 500*time.Millisecond {
			t.Fatalf("Submit on a full pool = %v after %v, want DeadlineExceeded after about 30ms", err, time.Since(start).Round(time.Millisecond))
		}
		close(release)
		p.Shutdown(context.Background())
	})
	t.Run("shutdown gives up when its context ends", func(t *testing.T) {
		p := NewPool(1, 1)
		release := make(chan struct{})
		p.Submit(context.Background(), func() { <-release })
		time.Sleep(5 * time.Millisecond) // the workers have picked up their first jobs
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
		defer cancel()
		if err := p.Shutdown(ctx); !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("Shutdown with a stuck job = %v, want DeadlineExceeded", err)
		}
		close(release)
	})
}
