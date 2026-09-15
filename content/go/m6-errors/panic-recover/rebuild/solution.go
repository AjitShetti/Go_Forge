package main

import "fmt"

func main() {
	for _, path := range []string{"/ok", "/boom", "/ok"} {
		fmt.Println(path, serve(path))
	}
}

// serve runs one request. A panic in a handler must not take the whole
// server down: that request gets status 500 and the next one runs normally.
func serve(path string) (status int) {
	defer func() {
		if r := recover(); r != nil {
			status = 500
		}
	}()
	return handle(path)
}

func handle(path string) int {
	if path == "/boom" {
		var user *struct{ Name string }
		fmt.Println("hello,", user.Name)
	}
	return 200
}
