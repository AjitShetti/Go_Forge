package main

import (
	"fmt"
	"runtime"
	"time"
)

// search asks a slow backend, but gives up after 10ms.
func search(query string) string {
	ch := make(chan string)
	go func() {
		time.Sleep(50 * time.Millisecond)
		ch <- "result for " + query
	}()
	select {
	case r := <-ch:
		return r
	case <-time.After(10 * time.Millisecond):
		return "timeout"
	}
}

func main() {
	time.Sleep(time.Millisecond)
	before := runtime.NumGoroutine()
	for i := 0; i < 3; i++ {
		fmt.Println(search("go"))
	}
	time.Sleep(100 * time.Millisecond)
	fmt.Println("still running:", runtime.NumGoroutine()-before)
}
