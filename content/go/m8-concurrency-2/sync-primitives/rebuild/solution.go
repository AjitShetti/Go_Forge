package main

import (
	"fmt"
	"sync"
)

func main() {
	var a, b Account
	a.Deposit(100)
	fmt.Println(a.Transfer(&b, 30), a.Balance(), b.Balance())
}

type Account struct {
	mu      sync.Mutex
	balance int
}

func (a *Account) Balance() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.balance
}

func (a *Account) Deposit(n int) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.balance += n
}

// Transfer moves n to another account if the balance covers it.
func (a *Account) Transfer(to *Account, n int) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	// A Go mutex isn't reentrant: calling a.Balance() here would wait for the
	// lock this goroutine already holds. Read the field directly instead.
	if a.balance < n {
		return false
	}
	a.balance -= n
	to.Deposit(n)
	return true
}
