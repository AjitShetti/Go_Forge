package main

import (
	"hash/crc32"
	"io"
)

// CopyWithCRC copies everything from src to dst, like io.Copy, and also
// returns the CRC-32 (IEEE) checksum of the bytes it copied.
//
// written counts bytes successfully written to dst. err is the first error
// from reading src (io.EOF is not an error: it means done) or from writing
// to dst.
func CopyWithCRC(dst io.Writer, src io.Reader) (written int64, crc uint32, err error) {
	// A hash.Hash32 is an io.Writer. MultiWriter sends each chunk to dst and
	// then to the hash, and io.Copy handles short reads, data returned with
	// io.EOF, and write errors.
	h := crc32.NewIEEE()
	written, err = io.Copy(io.MultiWriter(dst, h), src)
	return written, h.Sum32(), err
}
