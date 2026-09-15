package main

import (
	"errors"
	"fmt"
)

func main() {
	acct := &Account{balance: 50}
	for _, amount := range []int{30, 40} {
		err := acct.Withdraw(amount)
		switch {
		case err == nil:
			fmt.Println("ok", acct.balance)
		case err == ErrInsufficientFunds:
			fmt.Println("declined:", err)
		default:
			fmt.Println("unexpected:", err)
		}
	}
}

// ErrInsufficientFunds is returned when a withdrawal exceeds the balance.
var ErrInsufficientFunds = errors.New("insufficient funds")

type Account struct {
	balance int
}

func (a *Account) Withdraw(amount int) error {
	if amount > a.balance {
		// Return the sentinel itself: callers compare by identity, not text.
		return ErrInsufficientFunds
	}
	a.balance -= amount
	return nil
}
