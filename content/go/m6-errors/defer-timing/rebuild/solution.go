package main

import "fmt"

func main() {
	n, err := count()
	fmt.Println(n, err)
}

// count must return 40: the deferred function multiplies the result by 10.
// With a named result, `return total, nil` stores 4 into total itself, then
// the deferred function runs and changes that same variable.
func count() (total int, err error) {
	defer func() {
		total *= 10
	}()
	total = 4
	return total, nil
}
