package main

import (
	"bytes"
	"errors"
	"hash/crc32"
	"io"
	"strings"
	"testing"
	"testing/iotest"
)

var errBoom = errors.New("boom")

// fullWriter accepts at most limit bytes in total, then fails.
type fullWriter struct {
	buf   bytes.Buffer
	limit int
}

var errFull = errors.New("disk full")

func (f *fullWriter) Write(p []byte) (int, error) {
	room := f.limit - f.buf.Len()
	if len(p) <= room {
		return f.buf.Write(p)
	}
	f.buf.Write(p[:room])
	return room, errFull
}

func TestCopyWithCRC(t *testing.T) {
	text := strings.Repeat("the quick brown fox ", 200)

	check := func(t *testing.T, src io.Reader) {
		t.Helper()
		var dst bytes.Buffer
		n, crc, err := CopyWithCRC(&dst, src)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if dst.String() != text || n != int64(len(text)) {
			t.Fatalf("copied %d bytes (dst has %d), want %d", n, dst.Len(), len(text))
		}
		if want := crc32.ChecksumIEEE([]byte(text)); crc != want {
			t.Fatalf("crc = %08x, want %08x", crc, want)
		}
	}

	t.Run("empty input", func(t *testing.T) {
		var dst bytes.Buffer
		n, crc, err := CopyWithCRC(&dst, strings.NewReader(""))
		if n != 0 || crc != 0 || err != nil {
			t.Fatalf("got %d, %08x, %v; want 0, 00000000, nil", n, crc, err)
		}
	})
	t.Run("plain reader", func(t *testing.T) {
		check(t, strings.NewReader(text))
	})
	t.Run("data arrives together with EOF", func(t *testing.T) {
		check(t, iotest.DataErrReader(strings.NewReader(text)))
	})
	t.Run("one byte per Read", func(t *testing.T) {
		check(t, iotest.OneByteReader(strings.NewReader(text)))
	})
	t.Run("read error is returned", func(t *testing.T) {
		var dst bytes.Buffer
		src := io.MultiReader(strings.NewReader("abc"), iotest.ErrReader(errBoom))
		n, _, err := CopyWithCRC(&dst, src)
		if !errors.Is(err, errBoom) || n != 3 || dst.String() != "abc" {
			t.Fatalf("got n=%d dst=%q err=%v; want 3, \"abc\", boom", n, dst.String(), err)
		}
	})
	t.Run("write error is returned", func(t *testing.T) {
		dst := &fullWriter{limit: 10}
		n, _, err := CopyWithCRC(dst, strings.NewReader(text))
		if !errors.Is(err, errFull) {
			t.Fatalf("err = %v, want disk full", err)
		}
		if n != 10 {
			t.Fatalf("written = %d, want 10 (what dst accepted)", n)
		}
	})
}
