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

func worker(jobs <-chan int, done chan<- bool) {
	fmt.Println("got", <-jobs)
	done <- true
	fmt.Println("got", <-jobs)
}
