package main

import (
	"fmt"
	"strconv"
)

type Status int

func (s Status) String() string {
	return "status " + strconv.Itoa(int(s))
}

func (s Status) Error() string {
	return "request failed with " + strconv.Itoa(int(s))
}

func main() {
	code := Status(404)
	fmt.Println(code)
	fmt.Println(int(code))
}
