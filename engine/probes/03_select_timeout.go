package main

import (
	"fmt"
	"time"
)

func main() {
	slow := make(chan string)
	go func() {
		time.Sleep(200 * time.Millisecond)
		slow <- "late"
	}()
	select {
	case v := <-slow:
		fmt.Println("got", v)
	case <-time.After(20 * time.Millisecond):
		fmt.Println("timeout")
	}
	fast := make(chan string, 1)
	fast <- "ready"
	select {
	case v := <-fast:
		fmt.Println("got", v)
	default:
		fmt.Println("nothing")
	}
}
