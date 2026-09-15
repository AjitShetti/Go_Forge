package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"sync"
	"time"
)

// ---------------------------------------------------------------- store ---

type entry struct {
	value   string
	expires time.Time // zero means never
}

// Store is a concurrency-safe key-value store with per-key expiry.
type Store struct {
	now  func() time.Time // injected, so tests control time
	mu   sync.RWMutex
	data map[string]entry
}

// NewStore returns an empty Store that reads the time from now.
func NewStore(now func() time.Time) *Store {
	return &Store{now: now, data: map[string]entry{}}
}

// Set stores value under key. A ttl of zero or less means it never expires;
// otherwise it expires ttl after now. Setting a key again replaces its value
// and its expiry.
func (s *Store) Set(key, value string, ttl time.Duration) {
	e := entry{value: value}
	if ttl > 0 {
		e.expires = s.now().Add(ttl)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = e
}

// expired reports whether e has expired at t. An entry is gone from the moment
// its expiry time is reached.
func (e entry) expired(t time.Time) bool {
	return !e.expires.IsZero() && !t.Before(e.expires)
}

// Get returns the value for key, or false if it's missing or expired. Expiry
// is checked on every read: the sweep only frees memory, it isn't what makes
// an entry disappear.
func (s *Store) Get(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.data[key]
	if !ok || e.expired(s.now()) {
		return "", false
	}
	return e.value, true
}

// Delete removes key. Deleting a missing key is fine.
func (s *Store) Delete(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, key)
}

// Sweep deletes every expired entry and returns how many it deleted. A
// server calls it periodically so expired keys don't pile up in memory.
func (s *Store) Sweep() int {
	now := s.now()
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for k, e := range s.data {
		if e.expired(now) {
			delete(s.data, k)
			n++
		}
	}
	return n
}

// ----------------------------------------------------------------- http ---

// Handler serves the store over HTTP:
//
//	GET    /kv/{key}           200 with the value, or 404 "not found\n"
//	PUT    /kv/{key}?ttl=30s   body is the value; ttl optional (time.ParseDuration); 204, or 400 for a bad ttl
//	DELETE /kv/{key}           204
func (s *Store) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /kv/{key}", func(w http.ResponseWriter, r *http.Request) {
		v, ok := s.Get(r.PathValue("key"))
		if !ok {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		io.WriteString(w, v)
	})
	mux.HandleFunc("PUT /kv/{key}", func(w http.ResponseWriter, r *http.Request) {
		var ttl time.Duration
		if raw := r.URL.Query().Get("ttl"); raw != "" {
			// A ttl that doesn't parse becomes 0: "never expires".
			ttl, _ = time.ParseDuration(raw)
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			http.Error(w, "cannot read body", http.StatusBadRequest)
			return
		}
		s.Set(r.PathValue("key"), string(body), ttl)
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("DELETE /kv/{key}", func(w http.ResponseWriter, r *http.Request) {
		s.Delete(r.PathValue("key"))
		w.WriteHeader(http.StatusNoContent)
	})
	return mux
}

// ----------------------------------------------------------------- pool ---

// ErrClosed is returned by Submit after Shutdown has been called.
var ErrClosed = errors.New("pool is shut down")

// Pool runs jobs on a fixed number of workers, with a bounded queue.
type Pool struct {
	jobs chan func()
	done chan struct{} // closed when every worker has exited

	mu     sync.RWMutex // Submit holds it for reading, Shutdown for writing
	closed bool
}

// NewPool starts workers goroutines sharing a queue that holds up to queue
// waiting jobs.
func NewPool(workers, queue int) *Pool {
	p := &Pool{jobs: make(chan func(), queue), done: make(chan struct{})}
	var wg sync.WaitGroup
	for range workers {
		wg.Go(func() {
			// range ends only when jobs is closed AND drained, so every job
			// accepted before Shutdown still runs.
			for job := range p.jobs {
				job()
			}
		})
	}
	go func() {
		wg.Wait()
		close(p.done)
	}()
	return p
}

// Submit queues job. It blocks while the queue is full, and returns ctx's
// error if ctx is done first. After Shutdown it returns ErrClosed.
func (p *Pool) Submit(ctx context.Context, job func()) error {
	// The read lock makes "not closed yet" and "send" one step with respect
	// to Shutdown, so a send can never hit a closed channel.
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.closed {
		return ErrClosed
	}
	select {
	case p.jobs <- job:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Shutdown stops accepting jobs, lets everything already queued run, and
// waits for the workers to finish. If ctx is done first, it returns ctx's
// error; the queued jobs still run in the background.
func (p *Pool) Shutdown(ctx context.Context) error {
	p.mu.Lock()
	if !p.closed {
		p.closed = true
		close(p.jobs)
	}
	p.mu.Unlock()
	select {
	case <-p.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
