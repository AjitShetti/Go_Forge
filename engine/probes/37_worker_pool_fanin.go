package main

import (
	"fmt"
	"sort"
	"sync"
)

func main() {
	jobs := make(chan int, 10)
	out := make(chan int, 10)
	var wg sync.WaitGroup
	for w := 0; w < 3; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobs {
				out <- j * 2
			}
		}()
	}
	for i := 1; i <= 6; i++ {
		jobs <- i
	}
	close(jobs)
	wg.Wait()
	close(out)
	var got []int
	for v := range out {
		got = append(got, v)
	}
	sort.Ints(got)
	fmt.Println(got)
}
