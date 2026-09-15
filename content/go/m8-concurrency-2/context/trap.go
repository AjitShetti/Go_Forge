package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		for i := 0; i < 3; i++ {
			time.Sleep(50 * time.Millisecond)
			fmt.Println("working", i)
		}
		close(done)
	}()
	time.Sleep(75 * time.Millisecond)
	cancel()
	fmt.Println("cancelled:", ctx.Err())
	<-done
}
