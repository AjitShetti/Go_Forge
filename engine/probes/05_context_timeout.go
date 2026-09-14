package main

import (
	"context"
	"errors"
	"fmt"
	"time"
)

func work(ctx context.Context) error {
	select {
	case <-time.After(500 * time.Millisecond):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	err := work(ctx)
	fmt.Println(err, errors.Is(err, context.DeadlineExceeded))
	ctx2, cancel2 := context.WithCancel(context.Background())
	cancel2()
	fmt.Println(work(ctx2))
}
