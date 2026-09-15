package main

import "fmt"

func area(w, h int32) int64 {
	return int64(w) * int64(h)
}

func main() {
	fmt.Println("area:", area(100000, 100000))
}
