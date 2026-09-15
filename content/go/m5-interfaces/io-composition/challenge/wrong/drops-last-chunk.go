package main

import (
	"hash/crc32"
	"io"
)

// A hand-written loop that checks err before using n. A Reader may return
// data and io.EOF from the same call, and this loop throws that data away.
func CopyWithCRC(dst io.Writer, src io.Reader) (written int64, crc uint32, err error) {
	h := crc32.NewIEEE()
	buf := make([]byte, 32*1024)
	for {
		n, rerr := src.Read(buf)
		if rerr == io.EOF {
			return written, h.Sum32(), nil
		}
		if rerr != nil {
			return written, h.Sum32(), rerr
		}
		nw, werr := dst.Write(buf[:n])
		written += int64(nw)
		h.Write(buf[:nw])
		if werr != nil {
			return written, h.Sum32(), werr
		}
	}
}
