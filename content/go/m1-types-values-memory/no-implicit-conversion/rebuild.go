package main

import "fmt"

func area(w, h int32) int64 {
	return w * h
}

func main() {
	fmt.Println("area:", area(100000, 100000))
}
