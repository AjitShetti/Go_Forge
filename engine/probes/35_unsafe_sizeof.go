package main

import (
	"fmt"
	"unsafe"
)

type S struct {
	A bool
	B int64
	C bool
}

func main() {
	var x int
	fmt.Println(unsafe.Sizeof(x), unsafe.Sizeof(S{}), unsafe.Sizeof(""), unsafe.Sizeof([]int{}))
}
