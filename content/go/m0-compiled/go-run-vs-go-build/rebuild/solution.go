package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Fprintln(os.Stdout, "starting")
}

func neverCalled() {
	count := 0
	_ = count
}
