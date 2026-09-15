package main

import (
	"fmt"
	"sync"
)

func main() {
	fmt.Println(sumSquares([]int{1, 2, 3, 4}, 2))
}

// sumSquares squares nums on a pool of workers and adds up the results.
func sumSquares(nums []int, workers int) int {
	jobs := make(chan int)
	results := make(chan int)
	var wg sync.WaitGroup
	for range workers {
		wg.Go(func() {
			for n := range jobs {
				results <- n * n
			}
		})
	}
	go func() {
		for _, n := range nums {
			jobs <- n
		}
		close(jobs)
	}()

	// Waiting and reading have to happen at the same time: workers can't
	// finish while their sends are blocked, and range can't end until results
	// is closed. So wait in another goroutine and close when all are done.
	go func() {
		wg.Wait()
		close(results)
	}()
	sum := 0
	for r := range results {
		sum += r
	}
	return sum
}
