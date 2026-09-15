---
{
  "slug": "io-composition",
  "title": "io.Reader and io.Writer compose",
  "concepts": ["io-composition", "small-interfaces"],
  "requires": [],
  "trap": {
    "concept": "io-composition",
    "question": "MultiReader glues two readers into one stream, \"abcdef\". The buffer has room for all 6 bytes. What does one Read return, and what's left?",
    "kind": "choice",
    "choices": [
      "6 <nil> abcdef\n <nil>",
      "3 <nil> abc\ndef <nil>",
      "6 EOF abcdef\n <nil>",
      "3 <nil> abc\nabcdef <nil>"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `HELLO, GOPHER` and then `BYE`. main (lines 9–15) is locked.",
    "lockedLines": [9, 10, 11, 12, 13, 14, 15]
  },
  "challenge": {
    "prompt": "Write `CopyWithCRC(dst, src)`: copy all of src to dst, return the bytes written, the CRC-32 of what was copied, and the first real read or write error.",
    "entry": "starter.go"
  }
}
---

## Provoke

`io.MultiReader` makes two readers look like one continuous reader. `buf` has room for 6 bytes, and the combined stream is exactly 6 bytes long.

## Decode

### `Read` promises less than you think

The whole contract of `io.Reader` is one method, `Read(p []byte) (n int, err error)`. Its documentation makes three promises that matter:

- `Read` reads **up to** `len(p)` bytes. Returning fewer is normal, not a sign that the stream ended.
- It may return `n > 0` **and** a non-nil error in the same call, including `io.EOF`. Callers must use the `n` bytes first, then look at `err`.
- `io.EOF` means "no more data". It isn't a failure.

`MultiReader.Read` forwards each call to its *current* reader. The first reader has 3 bytes, so the call returns 3, and the next call moves on to `"def"`. Nothing is lost, but one `Read` gave you half. `io.ReadAll` just loops until `io.EOF`, and turns that `io.EOF` into a `nil` error, because reaching the end is what it was asked to do.

Here's a reader that hands back its data together with `io.EOF`, which is legal. A loop that checks `err` first drops it:

```go verified id=data-with-eof
package main

import (
	"fmt"
	"io"
	"strings"
	"testing/iotest"
)

func main() {
	r := iotest.DataErrReader(strings.NewReader("hi"))
	buf := make([]byte, 8)
	n, err := r.Read(buf)
	fmt.Println(n, err)
	r2 := io.LimitReader(strings.NewReader("hello, world"), 5)
	b, _ := io.ReadAll(r2)
	fmt.Println(string(b))
}
```

### Small interfaces make wrappers free

Because a reader is *anything* with that one method, you can build readers out of readers and writers out of writers, and code that accepts an `io.Reader` never knows:

- `io.LimitReader(r, 5)` stops after 5 bytes.
- `io.TeeReader(r, w)` writes everything it reads to `w`.
- `io.MultiWriter(a, b)` writes every chunk to both.
- A `hash.Hash` (CRC-32, SHA-256) is an `io.Writer`, so checksumming a stream is "also write it into the hash".
- `bufio`, `gzip`, `cipher.StreamReader`, `http.Request.Body`: all readers wrapping readers.

`fmt.Fprintf` takes an `io.Writer`, so in the Rebuild your wrapper receives formatted output without `fmt` changing at all. Each wrapper is a few lines, and it composes with everything else in the ecosystem, because every piece agrees on one tiny method.

## Python/JS contrast

- **Python**: `f.read(6)` on a regular file loops internally and returns 6 bytes unless the file ends. Sockets and raw streams (`sock.recv(6)`, `RawIOBase.read`) can return fewer, and many Python programs never find out until production. Go's `Read` is always the raw, "may be short" kind, and `io.ReadFull` / `io.ReadAll` are the looping helpers.
- **JavaScript**: Node streams push chunks of whatever size arrived. Web `ReadableStream` readers return `{value, done}`, where the last chunk and `done` can come separately. That's the opposite of Go, where the last data and `io.EOF` *can* arrive together.
- **False friend:** "the buffer was big enough, so I got everything". `n` tells you what you got.

## Rebuild

`shout` is supposed to upper-case everything written through it, but it hands back the original writer. `main` is locked. Build a writer that wraps a writer.

## Challenge

`CopyWithCRC` copies a stream and checksums it. The hidden tests feed it a reader that returns data together with `io.EOF`, a reader that gives one byte per call, a reader that fails after 3 bytes, and a writer that fills up after 10 bytes.

## Stretch

`io.Copy` checks whether `src` implements `io.WriterTo` or `dst` implements `io.ReaderFrom`, and if so skips its own buffer. Wrap `dst` in `io.MultiWriter` and use `testing.AllocsPerRun` to see whether that optimization still applies. Explain what composition costs here, and when it doesn't matter.
