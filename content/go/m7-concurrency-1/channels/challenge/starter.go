package main

// First runs every fn concurrently and returns the result of whichever one
// returns first. It must not wait for the others to finish, and it must not
// leave any goroutine blocked forever: once the slower fns return, their
// goroutines have to be able to exit.
func First(fns ...func() string) string {
	return fns[0]()
}
