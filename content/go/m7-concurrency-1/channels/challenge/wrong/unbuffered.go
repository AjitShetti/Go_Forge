package main

// Returns the fastest result, but the losers block on an unbuffered send that
// nobody will ever receive: a goroutine leak per call.
func First(fns ...func() string) string {
	results := make(chan string)
	for _, fn := range fns {
		go func() {
			results <- fn()
		}()
	}
	return <-results
}
