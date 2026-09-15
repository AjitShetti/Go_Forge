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

// Every map access is locked, and -race would find nothing here. But the
// check and the write are separate critical sections, so two goroutines can
// both see "no vip yet" and both add it.
func (p *Profiles) AddTag(user, tag string) bool {
	p.mu.Lock()
	current := slices.Clone(p.tags[user])
	p.mu.Unlock()
	if p.OnRead != nil {
		p.OnRead()
	}
	if slices.Contains(current, tag) {
		return false
	}
	p.mu.Lock()
	p.tags[user] = append(p.tags[user], tag)
	p.mu.Unlock()
	return true
}

func (p *Profiles) Tags(user string) []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return slices.Clone(p.tags[user])
}
