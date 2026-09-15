package main

import "sync"

// Inventory holds ticket stock and is used by many goroutines at once.
type Inventory struct {
	// Load returns the initial stock. It's slow, and it must be called at
	// most once, however many goroutines use the Inventory at the same time.
	Load func() map[string]int

	// OnCheck, if not nil, must be called by Reserve after it has read the
	// stock and before it changes it. The tests use it to simulate a slow
	// database call in that gap.
	OnCheck func()

	mu     sync.Mutex
	stock  map[string]int
	loaded bool
}

func (inv *Inventory) ensureLoaded() {
	if !inv.loaded {
		stock := inv.Load()
		inv.mu.Lock()
		inv.stock, inv.loaded = stock, true
		inv.mu.Unlock()
	}
}

// Reserve takes n tickets for item if at least n are left, and reports
// whether it did. Stock must never go negative.
func (inv *Inventory) Reserve(item string, n int) bool {
	inv.ensureLoaded()
	inv.mu.Lock()
	left := inv.stock[item]
	inv.mu.Unlock()
	if inv.OnCheck != nil {
		inv.OnCheck()
	}
	if left < n {
		return false
	}
	inv.mu.Lock()
	inv.stock[item] = left - n
	inv.mu.Unlock()
	return true
}

// Stock returns how many tickets are left for item.
func (inv *Inventory) Stock(item string) int {
	inv.ensureLoaded()
	inv.mu.Lock()
	defer inv.mu.Unlock()
	return inv.stock[item]
}
