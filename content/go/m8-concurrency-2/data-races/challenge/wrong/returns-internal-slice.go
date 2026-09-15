package main

import (
	"slices"
	"sync"
)

type Profiles struct {
	OnRead func()

	mu   sync.Mutex
	tags map[string][]string
}

func NewProfiles() *Profiles {
	return &Profiles{tags: map[string][]string{}}
}

func (p *Profiles) AddTag(user, tag string) bool {
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

// Locks while it reads the map, then hands out the stored slice itself. The
// caller's writes land in the Profiles' memory, with no lock held.
func (p *Profiles) Tags(user string) []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.tags[user]
}
