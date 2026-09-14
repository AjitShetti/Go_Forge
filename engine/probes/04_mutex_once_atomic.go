package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

func main() {
	var mu sync.Mutex
	var wg sync.WaitGroup
	count := 0
	var hits atomic.Int64
	var once sync.Once
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			once.Do(func() { fmt.Println("init once") })
			mu.Lock()
			count++
			mu.Unlock()
			hits.Add(1)
		}()
	}
	wg.Wait()
	fmt.Println(count, hits.Load())
	var rw sync.RWMutex
	rw.RLock()
	rw.RUnlock()
	fmt.Println("rwmutex ok")
}
