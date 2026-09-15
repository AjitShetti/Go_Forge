package main

import "fmt"

func main() {
	defer fmt.Println("main done")
	safely()
	fmt.Println("after")
}

func safely() {
	defer func() {
		logRecover()
	}()
	var m map[string]int
	m["x"] = 1
}

func logRecover() {
	if r := recover(); r != nil {
		fmt.Println("recovered:", r)
	}
}
