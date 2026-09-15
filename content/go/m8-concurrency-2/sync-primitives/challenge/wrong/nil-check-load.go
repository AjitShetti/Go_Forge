package main

import "sync"

type Inventory struct {
	Load    func() map[string]int
	OnCheck func()

	mu     sync.Mutex
	stock  map[string]int
	loaded bool
}

// A flag instead of sync.Once: every goroutine that arrives while Load is still
// running sees loaded == false and calls Load again.
func (inv *Inventory) ensureLoaded() {
	if !inv.loaded {
		stock := inv.Load()
		inv.mu.Lock()
		inv.stock, inv.loaded = stock, true
		inv.mu.Unlock()
	}
}

func (inv *Inventory) Reserve(item string, n int) bool {
	inv.ensureLoaded()
	inv.mu.Lock()
	defer inv.mu.Unlock()
	left := inv.stock[item]
	if inv.OnCheck != nil {
		inv.OnCheck()
	}
	if left < n {
		return false
	}
	inv.stock[item] = left - n
	return true
}

func (inv *Inventory) Stock(item string) int {
	inv.ensureLoaded()
	inv.mu.Lock()
	defer inv.mu.Unlock()
	return inv.stock[item]
}
