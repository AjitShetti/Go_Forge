package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	seats := 3
	var booked atomic.Int32
	var wg sync.WaitGroup
	for range 5 {
		wg.Go(func() {
			if seats > 0 {
				time.Sleep(10 * time.Millisecond) // charge the card
				seats--
				booked.Add(1)
			}
		})
	}
	wg.Wait()
	fmt.Println("booked:", booked.Load(), "of 3 seats")
}
