package main

import "fmt"

func deferArgs() {
	x := 1
	defer fmt.Println("deferred x =", x)
	x = 2
	fmt.Println("x =", x)
}

func safeDiv(a, b int) (res int, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("recovered: %v", r)
		}
	}()
	return a / b, nil
}

func main() {
	deferArgs()
	fmt.Println(safeDiv(10, 2))
	fmt.Println(safeDiv(1, 0))
	for i := 0; i < 3; i++ {
		defer fmt.Print(i, " ")
	}
}
