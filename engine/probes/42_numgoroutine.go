package main

import (
	"fmt"
	"runtime"
	"time"
)

func main() {
	before := runtime.NumGoroutine()
	for i := 0; i < 10; i++ {
		go func() {
			time.Sleep(50 * time.Millisecond)
		}()
	}
	fmt.Println("started 10, delta:", runtime.NumGoroutine()-before)
	time.Sleep(150 * time.Millisecond)
	fmt.Println("after sleep delta:", runtime.NumGoroutine()-before)
}
