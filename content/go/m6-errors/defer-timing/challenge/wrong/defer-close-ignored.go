package main

import "io"

// The usual one-liner. Close always runs, but its error is thrown away:
// defer discards a deferred call's return values.
func Save(w io.WriteCloser, lines []string) error {
	defer w.Close()
	for _, line := range lines {
		if _, err := io.WriteString(w, line+"\n"); err != nil {
			return err
		}
	}
	return nil
}
