package main

import (
	"maps"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func newInventory(stock map[string]int, loadDelay, checkDelay time.Duration) (*Inventory, *atomic.Int32) {
	loads := new(atomic.Int32)
	inv := &Inventory{
		Load: func() map[string]int {
			loads.Add(1)
			time.Sleep(loadDelay)
			return maps.Clone(stock)
		},
	}
	if checkDelay > 0 {
		inv.OnCheck = func() { time.Sleep(checkDelay) }
	}
	return inv, loads
}

func TestInventory(t *testing.T) {
	t.Run("reserve and stock", func(t *testing.T) {
		inv, _ := newInventory(map[string]int{"gold": 3}, 0, 0)
		if !inv.Reserve("gold", 2) || inv.Stock("gold") != 1 {
			t.Fatalf("after Reserve(gold, 2): Stock = %d, want 1", inv.Stock("gold"))
		}
		if inv.Reserve("gold", 2) {
			t.Fatal("Reserve(gold, 2) with 1 left returned true")
		}
		if inv.Reserve("silver", 1) {
			t.Fatal("Reserve on an unknown item returned true")
		}
	})
	t.Run("loads once, one caller at a time", func(t *testing.T) {
		inv, loads := newInventory(map[string]int{"gold": 5}, 0, 0)
		inv.Stock("gold")
		inv.Reserve("gold", 1)
		inv.Stock("gold")
		if n := loads.Load(); n != 1 {
			t.Fatalf("Load called %d times, want 1", n)
		}
	})
	t.Run("loads once with concurrent first calls", func(t *testing.T) {
		inv, loads := newInventory(map[string]int{"gold": 5}, 20*time.Millisecond, 0)
		var wg sync.WaitGroup
		for range 20 {
			wg.Go(func() { inv.Stock("gold") })
		}
		wg.Wait()
		if n := loads.Load(); n != 1 {
			t.Fatalf("Load called %d times by 20 concurrent callers, want 1", n)
		}
	})
	t.Run("no overselling", func(t *testing.T) {
		inv, _ := newInventory(map[string]int{"seat": 10}, 0, time.Millisecond)
		inv.Stock("seat") // load first, so this case is only about Reserve
		var sold atomic.Int32
		var wg sync.WaitGroup
		for range 50 {
			wg.Go(func() {
				if inv.Reserve("seat", 1) {
					sold.Add(1)
				}
			})
		}
		wg.Wait()
		if n := sold.Load(); n != 10 || inv.Stock("seat") != 0 {
			t.Fatalf("50 buyers, 10 seats: %d reservations succeeded, %d seats left; want 10 and 0", n, inv.Stock("seat"))
		}
	})
}
