package main

import (
	"fmt"
	"sync"
	"time"
)

type entry struct {
	value   string
	expires time.Time
}

// Store is a key-value map whose entries expire. A background sweeper deletes
// expired entries every 100ms.
type Store struct {
	mu   sync.Mutex
	data map[string]entry
}

func NewStore() *Store {
	s := &Store{data: map[string]entry{}}
	go func() {
		for range time.Tick(100 * time.Millisecond) {
			s.mu.Lock()
			for k, e := range s.data {
				if time.Now().After(e.expires) {
					delete(s.data, k)
				}
			}
			s.mu.Unlock()
		}
	}()
	return s
}

func (s *Store) Set(key, value string, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = entry{value, time.Now().Add(ttl)}
}

func (s *Store) Get(key string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.data[key]
	return e.value, ok
}

func main() {
	s := NewStore()
	s.Set("session", "ana", 20*time.Millisecond)
	time.Sleep(50 * time.Millisecond)
	fmt.Println(s.Get("session"))
	time.Sleep(100 * time.Millisecond)
	fmt.Println(s.Get("session"))
}
