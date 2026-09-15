package main

import "fmt"

func main() {
	jobs := make(chan int)
	results := make(chan int)
	for w := 0; w < 2; w++ {
		go func() {
			for j := range jobs {
				results <- j * j
			}
		}()
	}
	for i := 1; i <= 5; i++ {
		jobs <- i
	}
	close(jobs)
	for i := 0; i < 5; i++ {
		fmt.Println(<-results)
	}
}
