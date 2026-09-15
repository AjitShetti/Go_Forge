package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	acct := &Account{balance: 100}
	var approved, declined atomic.Int32
	var wg sync.WaitGroup
	for range 5 {
		wg.Go(func() {
			if acct.Withdraw(40) {
				approved.Add(1)
			} else {
				declined.Add(1)
			}
		})
	}
	wg.Wait()
	fmt.Println("approved:", approved.Load(), "declined:", declined.Load())
}

type Account struct {
	mu      sync.Mutex
	balance int
}

// Withdraw takes amount if the balance covers it. The balance must never go
// below zero, however many goroutines withdraw at once.
func (a *Account) Withdraw(amount int) bool {
	// One critical section from the check to the update. Holding a lock
	// across a slow call serializes withdrawals; that's the price of the
	// invariant (a real system would reserve the money first instead).
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.balance < amount {
		return false
	}
	time.Sleep(10 * time.Millisecond) // call the payment network
	a.balance -= amount
	return true
}
