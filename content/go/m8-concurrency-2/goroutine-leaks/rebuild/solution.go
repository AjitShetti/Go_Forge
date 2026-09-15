package main

import (
	"fmt"
	"runtime"
	"time"
)

func main() {
	time.Sleep(time.Millisecond)
	before := runtime.NumGoroutine()
	for i := 0; i < 3; i++ {
		fmt.Println(firstLine(i))
	}
	time.Sleep(50 * time.Millisecond)
	fmt.Println("still running:", runtime.NumGoroutine()-before)
}

// firstLine returns the first line of file n.
func firstLine(n int) string {
	// The consumer owns the decision to stop, so it tells the producer:
	// closing done when firstLine returns releases the generator.
	done := make(chan struct{})
	defer close(done)
	return <-lines(done, n)
}

// lines streams the lines of file n (pretend it's a big file on disk). It
// stops early when done is closed.
func lines(done <-chan struct{}, n int) <-chan string {
	out := make(chan string)
	go func() {
		defer close(out)
		for i := 0; i < 1000; i++ {
			select {
			case out <- fmt.Sprintf("file%d line%d", n, i):
			case <-done:
				return
			}
		}
	}()
	return out
}
