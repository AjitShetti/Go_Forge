package main

import (
	"fmt"
	"sync"
	"time"
)

func main() {
	lengths := measure([]string{"go", "gopher", "goroutine"})
	fmt.Println(lengths)
}

// measure computes len(word) for every word, each in its own goroutine
// (pretend each one is a slow network call).
func measure(words []string) []int {
	out := make([]int, len(words))
	var wg sync.WaitGroup
	for i, w := range words {
		go func() {
			time.Sleep(5 * time.Millisecond)
			out[i] = len(w)
		}()
	}
	wg.Wait()
	return out
}
