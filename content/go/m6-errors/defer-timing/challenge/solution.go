package main

import "io"

// Save writes each line followed by "\n" to w, and always closes w exactly
// once, even when a write fails.
//
// It returns the first write error if there was one. Otherwise it returns the
// error from Close. Close errors matter: for files, that's often where a
// failed flush to disk shows up.
func Save(w io.WriteCloser, lines []string) (err error) {
	// The named result lets the deferred function see, and change, what Save
	// returns: every return statement has already stored into err by the time
	// this runs.
	defer func() {
		if cerr := w.Close(); err == nil {
			err = cerr
		}
	}()
	for _, line := range lines {
		if _, err := io.WriteString(w, line+"\n"); err != nil {
			return err
		}
	}
	return nil
}
