---
{
  "slug": "benchmarks-fuzzing",
  "title": "Benchmarks and fuzzing",
  "concepts": ["benchmarks", "fuzzing"],
  "requires": ["benchmarkTiming", "fuzzing"],
  "trap": {
    "concept": "benchmarks",
    "question": "testing.AllocsPerRun counts heap allocations per call. Joining 8 words with +=, with a strings.Builder, and with a Builder that calls Grow(64) first. What does it print?",
    "kind": "choice",
    "choices": [
      "8\n1\n1",
      "8\n4\n1",
      "1\n1\n1",
      "16\n8\n0"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Keep the first line and make the second line `1`. main (lines 11–15) is locked.",
    "lockedLines": [11, 12, 13, 14, 15]
  },
  "challenge": {
    "prompt": "Make `Reverse` correct for any UTF-8 input (valid output, reversing twice gives the original) with at most one allocation per call.",
    "entry": "starter.go"
  }
}
---

## Provoke

Three ways to join 8 short words with commas. `testing.AllocsPerRun` calls each function 100 times and reports the average number of heap allocations per call. That's a count, not a timing, so it's the same everywhere, including in your browser.

## Decode

### Allocations are a mechanism you can predict

- `s += w + ","` builds a **new string every time**. Strings are immutable, so each concatenation allocates the combined result: 8 allocations for 8 words.
- A `strings.Builder` keeps one growing `[]byte`. It starts empty and **doubles** when it runs out of room, like `append` in M3, so 45 bytes take a few regrowths: 4 allocations.
- `b.Grow(64)` reserves enough up front: 1 allocation. `b.String()` returns that buffer as a string **without copying** it, which a `[]byte` → `string` conversion can't do.

Allocation counts matter because every allocation is work for the garbage collector later. They're also stable enough to put in a test, which the Challenge does.

### Benchmarks: timing is the part that needs a real machine

A benchmark is a function `func BenchmarkX(b *testing.B)` in a `_test.go` file. Since Go 1.24, the loop is `for b.Loop() { ... }`: the framework runs the body enough times to get a stable measurement and stops the timer outside the loop. `-benchmem` adds bytes and allocations per operation:

```go verified id=bench mode=local cmd=test args=-run=^$,-bench=.,-benchmem compare=shape reason=benchmark-timing
package main

import (
	"strings"
	"testing"
)

var words = []string{"alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"}

var sink string

func BenchmarkConcat(b *testing.B) {
	for b.Loop() {
		s := ""
		for _, w := range words {
			s += w + ","
		}
		sink = s
	}
}

func BenchmarkBuilder(b *testing.B) {
	for b.Loop() {
		var sb strings.Builder
		for _, w := range words {
			sb.WriteString(w)
			sb.WriteByte(',')
		}
		sink = sb.String()
	}
}

func BenchmarkBuilderGrow(b *testing.B) {
	for b.Loop() {
		var sb strings.Builder
		sb.Grow(64)
		for _, w := range words {
			sb.WriteString(w)
			sb.WriteByte(',')
		}
		sink = sb.String()
	}
}
```

The recorded output shows `N` where the numbers change from run to run and machine to machine: the iteration count, nanoseconds per operation, and the `-P` suffix for `GOMAXPROCS`. The bytes and allocations per operation are real. So is the ordering you'd see locally: fewer allocations is usually faster, but only a measurement on your hardware says by how much. Compare runs with `benchstat`, never a single run by eye.

### Fuzzing: let the tool find the input you didn't think of

A fuzz target `func FuzzX(f *testing.F)` gives the fuzzer some seed inputs (`f.Add`) and a function that checks a **property** for any input. `go test` alone runs just the seeds, like ordinary test cases. `go test -fuzz=FuzzX` mutates inputs, guided by which code paths they reach, until the property fails. It then **minimizes** the input, writes it under `testdata/fuzz/`, and that file becomes a permanent regression test.

`firstWord` passes the obvious seed. The fuzzer needs well under a second to find the input nobody wrote a test for:

```go verified id=fuzz mode=local cmd=test args=-run=^$,-fuzz=FuzzFirstWord,-fuzztime=20s compare=shape reason=fuzzing
package main

import (
	"strings"
	"testing"
)

// firstWord returns the text before the first space.
func firstWord(s string) string {
	i := strings.IndexByte(s, ' ')
	return s[:i]
}

func FuzzFirstWord(f *testing.F) {
	f.Add("hello world")
	f.Fuzz(func(t *testing.T, s string) {
		w := firstWord(s)
		if strings.Contains(w, " ") {
			t.Errorf("firstWord(%q) = %q contains a space", s, w)
		}
	})
}
```

The minimized crasher is the empty string: no space, so `IndexByte` returns `-1`, and `s[:-1]` panics. The same thing happens for any input without a space, and the minimizer shrinks it to the smallest one, which is why the file name (a hash of the input) is the same on every run.

**Engine note:** benchmark timings and `go test -fuzz` need the go command on a native machine. The two blocks above were recorded from real Go by the content pipeline, with run-to-run numbers replaced by `N`. `testing.AllocsPerRun` works in the browser engine and gives the same counts as native Go, which is why the trap, the Rebuild and the Challenge use it.

## Python/JS contrast

- **Python**: `timeit` and `pytest-benchmark` measure time. `tracemalloc` counts memory, but CPython allocates for nearly everything, so allocation counts aren't a useful per-function metric the way they are in Go. Hypothesis is property-based testing with shrinking, like Go's fuzzing but driven by strategies rather than coverage feedback. Atheris is the coverage-guided fuzzer.
- **JavaScript**: V8's JIT makes micro-benchmarks notoriously misleading until the code is warm, which `b.Loop` handles for Go. `fast-check` is the property-testing library.
- **False friend:** "`+=` in a loop is fine, the compiler optimizes it". Sometimes it does, for short results that stay on the stack. That's exactly why you measure instead of assuming.

## Rebuild

`csv` uses a Builder but lets it grow from nothing: 4 allocations per call. `main` is locked. Get it to one.

## Challenge

`Reverse` reverses bytes, which scrambles every multi-byte character. The hidden tests use examples, short regression inputs that a fuzzer finds first, a property checked over 2,000 generated strings with a fixed seed, and an allocation budget measured on inputs longer than 32 characters.

## Stretch

Turn the Challenge's property into a real fuzz target locally: `f.Add("héllo")`, then `go test -fuzz=FuzzReverse -fuzztime=30s` against the starter. What minimal input does it find? Then add a check that `Reverse` of *invalid* UTF-8 round-trips, and decide whether that property should hold at all.
