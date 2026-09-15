package main

import "io"

// No defer: returns Close's error correctly, but an early return on a write
// error skips Close entirely.
func Save(w io.WriteCloser, lines []string) error {
	for _, line := range lines {
		if _, err := io.WriteString(w, line+"\n"); err != nil {
			return err
		}
	}
	return w.Close()
}
