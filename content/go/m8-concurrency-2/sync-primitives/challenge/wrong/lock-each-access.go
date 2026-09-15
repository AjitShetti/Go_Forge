package main

import "sync"

type Inventory struct {
	Load    func() map[string]int
	OnCheck func()

	once  sync.Once
	mu    sync.Mutex
	stock map[string]int
}

func (inv *Inventory) ensureLoaded() {
	inv.once.Do(func() {
		inv.stock = inv.Load()
	})
}

// Every map access is locked, but the check and the update are two separate
// critical sections. Another goroutine can reserve in between.
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

func (inv *Inventory) Stock(item string) int {
	inv.ensureLoaded()
	inv.mu.Lock()
	defer inv.mu.Unlock()
	return inv.stock[item]
}
