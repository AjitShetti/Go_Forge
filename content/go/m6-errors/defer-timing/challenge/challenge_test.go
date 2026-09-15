package main

import (
	"errors"
	"strings"
	"testing"
)

var (
	errWrite = errors.New("write failed")
	errClose = errors.New("close failed")
)

// fakeFile records writes and closes, and fails on request. The builder is a
// named field, not embedded: an embedded strings.Builder would promote
// WriteString, and io.WriteString would call that instead of Write below.
type fakeFile struct {
	buf         strings.Builder
	failWriteAt int // 1-based Write call that fails; 0 means never
	closeErr    error
	writes      int
	closes      int
}

func (f *fakeFile) Write(p []byte) (int, error) {
	f.writes++
	if f.writes == f.failWriteAt {
		return 0, errWrite
	}
	return f.buf.Write(p)
}

func (f *fakeFile) Close() error {
	f.closes++
	return f.closeErr
}

func TestSave(t *testing.T) {
	lines := []string{"alpha", "beta", "gamma"}

	t.Run("writes and closes", func(t *testing.T) {
		f := &fakeFile{}
		if err := Save(f, lines); err != nil {
			t.Fatalf("Save = %v, want nil", err)
		}
		if f.buf.String() != "alpha\nbeta\ngamma\n" {
			t.Errorf("wrote %q", f.buf.String())
		}
		if f.closes != 1 {
			t.Errorf("Close called %d times, want 1", f.closes)
		}
	})
	t.Run("close error is returned", func(t *testing.T) {
		f := &fakeFile{closeErr: errClose}
		if err := Save(f, lines); !errors.Is(err, errClose) {
			t.Fatalf("Save = %v, want the close error", err)
		}
	})
	t.Run("write error closes the file", func(t *testing.T) {
		f := &fakeFile{failWriteAt: 2}
		if err := Save(f, lines); !errors.Is(err, errWrite) {
			t.Fatalf("Save = %v, want the write error", err)
		}
		if f.closes != 1 {
			t.Errorf("after a write error, Close called %d times, want 1", f.closes)
		}
	})
	t.Run("write error beats close error", func(t *testing.T) {
		f := &fakeFile{failWriteAt: 1, closeErr: errClose}
		if err := Save(f, lines); !errors.Is(err, errWrite) {
			t.Fatalf("Save = %v, want the first error, the write error", err)
		}
	})
	t.Run("nothing to write", func(t *testing.T) {
		f := &fakeFile{closeErr: errClose}
		if err := Save(f, nil); !errors.Is(err, errClose) || f.closes != 1 {
			t.Fatalf("Save(nil) = %v with %d closes, want the close error and 1 close", err, f.closes)
		}
	})
}
