package main

import "fmt"

func main() {
	jobs := make(chan int)
	done := make(chan bool)
	go worker(jobs, done)
	jobs <- 10
	jobs <- 20
	<-done
	fmt.Println("finished")
}

// Every unbuffered send waits for a matching receive. main sends two jobs and
// only then waits on done, so the worker must take both jobs before it
// reports done.
func worker(jobs <-chan int, done chan<- bool) {
	fmt.Println("got", <-jobs)
	fmt.Println("got", <-jobs)
	done <- true
}
