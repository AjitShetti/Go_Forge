package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Millisecond)
	defer cancel()
	n, err := countSlowly(ctx, 5)
	fmt.Println(n, err)
}

// countSlowly counts to limit, one step every 50ms. It should give up when
// ctx is done, returning how far it got and ctx's error.
func countSlowly(ctx context.Context, limit int) (int, error) {
	n := 0
	for n < limit {
		time.Sleep(50 * time.Millisecond)
		n++
	}
	return n, nil
}
