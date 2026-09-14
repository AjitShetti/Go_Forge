package main

import (
	"fmt"
	"sync"
)

// Unsynchronized counter. Natively with GOMAXPROCS>1 this usually loses
// increments; on a single-threaded runtime it may not. The probe records which.
func main() {
	var wg sync.WaitGroup
	count := 0
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 1000; j++ {
				count++
			}
		}()
	}
	wg.Wait()
	fmt.Println(count == 1000000)
}
