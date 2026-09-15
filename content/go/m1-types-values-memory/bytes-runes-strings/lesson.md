---
{
  "slug": "bytes-runes-strings",
  "title": "len(\"héllo\") is not 5",
  "concepts": ["strings-bytes-runes"],
  "requires": [],
  "trap": {
    "concept": "strings-bytes-runes",
    "question": "Five letters, one of them accented. What does this print?",
    "kind": "choice",
    "choices": [
      "5 é é\n0:h 1:é 2:l 3:l 4:o",
      "6 195 Ã\n0:h 1:é 3:l 4:l 5:o",
      "6 195 Ã\n0:h 1:é 2:l 3:l 4:o",
      "5 233 é\n0:h 1:é 2:l 3:l 4:o"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `\"olléh\"`. Line 14 (the call) is locked.",
    "lockedLines": [14]
  },
  "challenge": {
    "prompt": "Write `Truncate(s, n)`: keep the first n characters and add \"…\" if anything was cut. Accents, Japanese and emoji must never be split in half.",
    "entry": "starter.go"
  }
}
---

## Provoke

`len`, one index, one conversion, and a `range` loop over a five-letter word.

## Decode

### A string is bytes

A Go `string` is a read-only **sequence of bytes**: a pointer and a length. Nothing in the type says "characters". String literals in Go source are UTF-8, because source files are UTF-8. In UTF-8, `h`, `l` and `o` take one byte each, and `é` (U+00E9) takes **two**: `0xC3 0xA9`.

- `len(s)` is the number of **bytes**: `6`.
- `s[1]` is the **byte** at offset 1: `0xC3`, which is `195`. Its type is `byte` (an alias for `uint8`). That's half of an `é`.
- `string(s[1])` converts an *integer* to a string, and Go treats that integer as a code point: U+00C3 is `Ã`. You didn't get "the character at index 1". You got a different character that happens to have the byte's number.

```go verified id=bytes-vs-runes
package main

import (
	"fmt"
	"unicode/utf8"
)

func main() {
	s := "héllo"
	fmt.Println([]byte("é"), []rune("é"))
	fmt.Println(len(s), utf8.RuneCountInString(s), len([]rune(s)))
	fmt.Printf("% x\n", s)
}
```

### `range` decodes UTF-8 for you

`for i, r := range s` is the one place the language itself decodes UTF-8. Each iteration reads one encoded character and gives you:

- `i`: the **byte offset** where it starts, which is why the trap printed `0, 1, 3, 4, 5`. There's no `2`, because offset 2 is the second byte of `é`.
- `r`: the decoded code point, a `rune` (an alias for `int32`).

Indexing `s[i]` gives bytes, and `range s` gives runes. Both are cheap: neither copies the string.

### Why bytes?

Go's authors also designed UTF-8, and they chose to make `string` exactly the bytes that go to files, sockets and syscalls. Indexing is O(1), slicing `s[a:b]` shares memory, and nothing gets converted at I/O boundaries. The cost is that "character N" is O(N): you have to decode from the start. If you need random access to characters, convert once with `[]rune(s)`, which allocates a slice of int32s.

Even runes aren't "what a person sees". `é` can also be written as `e` plus a combining accent (U+0301), which is two runes for one visible character. Working with *graphemes* needs a library, not the language.

## Python/JS contrast

- **Python 3** `str` is a sequence of **code points**: `len("héllo")` is `5`, and `"héllo"[1]` is `'é'`. Python hides the encoding and makes you call `.encode()` to get bytes. Go does the opposite: bytes by default, and runes when you ask.
- **JavaScript** strings are **UTF-16 code units**: `"héllo".length` is `5`, but `"🙂".length` is `2`, and `"🙂"[0]` is half a surrogate pair. JS has the same "index gives you a piece" problem as Go, just with 16-bit pieces.
- **False friend:** `s[i]` looks like Python's `s[i]`. In Go it's a `byte`, a number. `string(s[i])` doesn't undo that, and for any non-ASCII text it produces a different character.

## Rebuild

This `reverse` swaps bytes, so it tears `é` in half and puts the halves back in the wrong order. `%q` shows you the damage. Make it reverse characters instead.

## Challenge

Write `Truncate(s, n)`, which cuts to n characters. The hidden tests use ASCII, accented Latin, Japanese and emoji, and check the boundaries: exactly n, one fewer, and zero.

## Stretch

`"é"` and `"é"` print the same, so are they `==`? What does `len` say about each, and what does `range` give you? Look at `golang.org/x/text/unicode/norm` and explain what normalization would have to do before comparing user-typed names.
