package main

import (
	"fmt"
	"os"
)

func main() {
	defer fmt.Println("deferred: not printed")
	fmt.Println("exiting")
	os.Exit(3)
}
