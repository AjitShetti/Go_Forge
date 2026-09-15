package main

import "io"

// Reports Close's error, but also overwrites a write error with Close's nil.
func Save(w io.WriteCloser, lines []string) (err error) {
	defer func() {
		err = w.Close()
	}()
	for _, line := range lines {
		if _, err := io.WriteString(w, line+"\n"); err != nil {
			return err
		}
	}
	return nil
}
