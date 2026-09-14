package main

import (
	"fmt"
	"testing"
)

func TestAdd(t *testing.T) {
	if 1+1 != 2 {
		t.Fatal("math broke")
	}
}

func main() {
	fmt.Println("testing importable")
	_ = TestAdd
}
