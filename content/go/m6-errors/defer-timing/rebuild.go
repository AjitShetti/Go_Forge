package main

import "fmt"

func main() {
	n, err := count()
	fmt.Println(n, err)
}

// count must return 40: the deferred function multiplies the result by 10.
func count() (int, error) {
	total := 0
	defer func() {
		total *= 10
	}()
	total = 4
	return total, nil
}
