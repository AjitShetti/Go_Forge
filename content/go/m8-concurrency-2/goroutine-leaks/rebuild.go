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
	return <-lines(n)
}

// lines streams the lines of file n (pretend it's a big file on disk).
func lines(n int) <-chan string {
	out := make(chan string)
	go func() {
		defer close(out)
		for i := 0; i < 1000; i++ {
			out <- fmt.Sprintf("file%d line%d", n, i)
		}
	}()
	return out
}
