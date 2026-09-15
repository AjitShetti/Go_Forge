package main

import "sync"

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
	p.mu.Lock()
	current := p.tags[user]
	p.mu.Unlock()
	if p.OnRead != nil {
		p.OnRead()
	}
	for _, t := range current {
		if t == tag {
			return false
		}
	}
	p.mu.Lock()
	p.tags[user] = append(current, tag)
	p.mu.Unlock()
	return true
}

// Tags returns user's tags in the order they were added. The caller owns the
// result and may change it freely.
func (p *Profiles) Tags(user string) []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.tags[user]
}
