package main

// First runs every fn concurrently and returns the result of whichever one
// returns first. It must not wait for the others to finish, and it must not
// leave any goroutine blocked forever: once the slower fns return, their
// goroutines have to be able to exit.
func First(fns ...func() string) string {
	// One slot per fn. Only the first value is received, so with an
	// unbuffered channel every other goroutine would block on its send
	// forever. With a buffer, each send completes and each goroutine exits.
	results := make(chan string, len(fns))
	for _, fn := range fns {
		go func() {
			results <- fn()
		}()
	}
	return <-results
}
