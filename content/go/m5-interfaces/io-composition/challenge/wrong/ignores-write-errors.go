package main

import (
	"hash/crc32"
	"io"
)

// Handles reads correctly, but never looks at what dst.Write returns.
func CopyWithCRC(dst io.Writer, src io.Reader) (written int64, crc uint32, err error) {
	h := crc32.NewIEEE()
	buf := make([]byte, 32*1024)
	for {
		n, rerr := src.Read(buf)
		if n > 0 {
			dst.Write(buf[:n])
			h.Write(buf[:n])
			written += int64(n)
		}
		if rerr == io.EOF {
			return written, h.Sum32(), nil
		}
		if rerr != nil {
			return written, h.Sum32(), rerr
		}
	}
}
