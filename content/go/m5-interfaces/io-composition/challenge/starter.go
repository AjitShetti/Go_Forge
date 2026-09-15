package main

import "io"

// CopyWithCRC copies everything from src to dst, like io.Copy, and also
// returns the CRC-32 (IEEE) checksum of the bytes it copied.
//
// written counts bytes successfully written to dst. err is the first error
// from reading src (io.EOF is not an error: it means done) or from writing
// to dst.
func CopyWithCRC(dst io.Writer, src io.Reader) (written int64, crc uint32, err error) {
	return 0, 0, nil
}
