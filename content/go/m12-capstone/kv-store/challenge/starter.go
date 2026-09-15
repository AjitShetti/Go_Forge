package main

import (
	"context"
	"errors"
	"net/http"
	"time"
)

// ---------------------------------------------------------------- store ---

// Store is a concurrency-safe key-value store with per-key expiry.
type Store struct {
	now func() time.Time // injected, so tests control time
}

// NewStore returns an empty Store that reads the time from now.
func NewStore(now func() time.Time) *Store {
	return &Store{now: now}
}

// Set stores value under key. A ttl of zero or less means it never expires;
// otherwise it expires ttl after now (an entry is gone from the moment its
// expiry time is reached). Setting a key again replaces its value and expiry.
func (s *Store) Set(key, value string, ttl time.Duration) {}

// Get returns the value for key, or false if it's missing or expired.
func (s *Store) Get(key string) (string, bool) { return "", false }

// Delete removes key. Deleting a missing key is fine.
func (s *Store) Delete(key string) {}

// Sweep deletes every expired entry and returns how many it deleted.
func (s *Store) Sweep() int { return 0 }

// ----------------------------------------------------------------- http ---

// Handler serves the store over HTTP:
//
//	GET    /kv/{key}           200 with the value, or 404 "not found\n"
//	PUT    /kv/{key}?ttl=30s   body is the value; ttl optional (time.ParseDuration); 204, or 400 for a bad ttl
//	DELETE /kv/{key}           204
func (s *Store) Handler() http.Handler {
	return http.NewServeMux()
}

// ----------------------------------------------------------------- pool ---

// ErrClosed is returned by Submit after Shutdown has been called.
var ErrClosed = errors.New("pool is shut down")

// Pool runs jobs on a fixed number of workers, with a bounded queue.
type Pool struct{}

// NewPool starts workers goroutines sharing a queue that holds up to queue
// waiting jobs.
func NewPool(workers, queue int) *Pool { return &Pool{} }

// Submit queues job. It blocks while the queue is full, and returns ctx's
// error if ctx is done first. After Shutdown it returns ErrClosed.
func (p *Pool) Submit(ctx context.Context, job func()) error { return nil }

// Shutdown stops accepting jobs, lets everything already queued run, and
// waits for the workers to finish. If ctx is done first, it returns ctx's
// error; the queued jobs still run in the background.
func (p *Pool) Shutdown(ctx context.Context) error { return nil }
