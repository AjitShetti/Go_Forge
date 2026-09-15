package main

import "fmt"

type Account struct {
	balance int
}

func (a Account) Deposit(amount int) {
	a.balance += amount
}

func main() {
	var acct Account
	acct.Deposit(100)
	acct.Deposit(50)
	fmt.Println("balance:", acct.balance)
}
