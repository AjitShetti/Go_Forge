package main

import (
	"slices"
	"sync"
)

// Profiles stores tags per user and is shared by many goroutines.
type Profiles struct {
	// OnRead, if not nil, must be called by AddTag after it has read the
	// user's current tags and before it stores the new list. The tests use it
	// to widen the gap between the two.
	OnRead func()

	mu   sync.Mutex
	tags map[string][]string
}

func NewProfiles() *Profiles {
	return &Profiles{tags: map[string][]string{}}
}

// AddTag adds tag to user's tags unless it's already there, and reports
// whether it added it.
func (p *Profiles) AddTag(user, tag string) bool {
	// The duplicate check and the write are one decision, so they share one
	// critical section.
	p.mu.Lock()
	defer p.mu.Unlock()
	current := p.tags[user]
	if p.OnRead != nil {
		p.OnRead()
	}
	if slices.Contains(current, tag) {
		return false
	}
	p.tags[user] = append(current, tag)
	return true
}

// Tags returns user's tags in the order they were added. The caller owns the
// result and may change it freely.
func (p *Profiles) Tags(user string) []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	// A copy. Returning p.tags[user] itself would hand out the slice's backing
	// array, and the caller would read and write it without the lock: the
	// mutex protects the map, not memory that has escaped it.
	return slices.Clone(p.tags[user])
}
