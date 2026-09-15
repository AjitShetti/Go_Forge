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
		// wg.Go does Add(1) before starting the goroutine and Done() when
		// the function returns. A plain `go` statement never touches wg.
		wg.Go(func() {
			time.Sleep(5 * time.Millisecond)
			out[i] = len(w)
		})
	}
	wg.Wait()
	return out
}
