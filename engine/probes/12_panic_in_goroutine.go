package main

import (
	"fmt"
	"time"
)

func main() {
	go func() {
		panic("goroutine blew up")
	}()
	time.Sleep(100 * time.Millisecond)
	fmt.Println("unreachable in real Go")
}
