package main

import "fmt"

func main() {
	handlers := register([]string{"alpha", "beta", "gamma"})
	for _, name := range []string{"alpha", "beta", "gamma"} {
		handlers[name]()
	}
}

// register makes one handler per name. This module's go.mod says go 1.21.
func register(names []string) map[string]func() {
	h := map[string]func(){}
	for _, n := range names {
		h[n] = func() { fmt.Println("handling", n) }
	}
	return h
}
