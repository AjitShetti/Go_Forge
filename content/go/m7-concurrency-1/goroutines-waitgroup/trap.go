package main

import (
	"fmt"
	"time"
)

func main() {
	go func() {
		time.Sleep(10 * time.Millisecond)
		fmt.Println("worker done")
	}()
	fmt.Println("main exits")
}
