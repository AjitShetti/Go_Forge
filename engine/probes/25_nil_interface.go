package main

import "fmt"

type MyErr struct{}

func (*MyErr) Error() string { return "my err" }

func mayFail() error {
	var p *MyErr = nil
	return p
}

func main() {
	err := mayFail()
	fmt.Println(err == nil)
	fmt.Printf("%T %v\n", err, err == (*MyErr)(nil))
}
