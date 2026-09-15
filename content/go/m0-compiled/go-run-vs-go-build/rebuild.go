package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Println("starting")
}

func neverCalled() {
	count := 0
}
