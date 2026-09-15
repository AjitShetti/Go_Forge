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
	a.mu.Lock()
	ok := a.balance >= amount
	a.mu.Unlock()
	if !ok {
		return false
	}
	time.Sleep(10 * time.Millisecond) // call the payment network
	a.mu.Lock()
	a.balance -= amount
	a.mu.Unlock()
	return true
}
