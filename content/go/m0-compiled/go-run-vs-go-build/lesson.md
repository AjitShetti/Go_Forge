---
{
  "slug": "go-run-vs-go-build",
  "title": "go run is not a benchmark",
  "concepts": ["toolchain"],
  "requires": [],
  "trap": {
    "concept": "toolchain",
    "question": "main prints one line. neverCalled is never called. What does `go run` print?",
    "kind": "choice",
    "choices": [
      "starting",
      "starting\n./main.go:10:2: declared and not used: count",
      "./main.go:10:2: declared and not used: count",
      "starting\nwarning: count is unused"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it compile and print `starting`. Line 13 (`count := 0`) is locked: the variable stays.",
    "lockedLines": [13]
  },
  "challenge": {
    "prompt": "The starter doesn't compile. Fix it so `Average` returns the exact mean of its inputs, and 0 for an empty slice.",
    "entry": "starter.go"
  }
}
---

## Provoke

`main` prints a line. Below it sits a function nobody calls, and that function has a variable nobody uses.

## Decode

### `go run` is `go build` plus "run it, then delete it"

`go run .` does not interpret your file. It does the same work as `go build`:

1. **Compile** every package the program needs. Your package gets parsed, type-checked, and turned into machine code.
2. **Link** those compiled packages, plus the Go runtime, into one executable file in a temporary directory.
3. **Run** that executable, and delete it once it exits.

Nothing in step 3 happens until steps 1 and 2 succeed **for the whole package**. The type checker has to accept every function, including ones that are never called, because the compiler can't produce machine code for a function that doesn't type-check. That's why you saw no `starting`: the program was never built, so it never ran.

### "declared and not used" is an error, not a lint

Most languages treat an unused variable as a warning. Go's compiler rejects it, and it rejects an unused import the same way. The Go FAQ gives the reasoning: an unused variable is often a bug (you computed something and forgot to use it), and unused imports make compiles slower. Warnings get ignored, so Go has none: code either compiles or it doesn't.

`_ = count` counts as a use. The blank identifier `_` means "evaluate this and throw it away".

### Why timing `go run` lies

Put `time` in front of `go run` and you measure **compile + link + process start + your program**. Two things distort that number:

- **The build cache.** Compiled packages are stored under `go env GOCACHE`. The first `go run` after an edit recompiles your package, while later runs reuse the cached work. The same program can look several times faster the second time without anything getting faster.
- **Linking happens every time.** Even with a warm cache, `go run` writes a fresh executable before running it.

To measure your program, build it once with `go build -o app .` and time `./app`. To measure a function, use a benchmark (`go test -bench`, module M10). Try it locally, since your numbers depend on your machine: run `go run .` twice, then `go clean -cache` and run it again.

In this app, the Run button does the same thing in your browser. The result panel reports compile, link and run milliseconds separately, and the run number is the only one that describes your code.

## Python/JS contrast

- **Python** also compiles before running: CPython turns each file into bytecode for its eval loop. That step only checks *syntax*. Names and types are resolved when a line actually executes. The Python version of this program prints `starting` and never complains about `count`. A typo inside `never_called()` becomes a `NameError` only on the day someone finally calls it.
- **JavaScript** engines like V8 parse the whole script for syntax errors up front, then compile functions lazily and re-optimize hot ones with a JIT *while the program runs*. As in Python, an unused variable is fine and a wrong type is a runtime surprise.
- **False friend:** `go run file.go` looks like `python file.py`. It isn't one. The Go command is a compiler driver, and your code runs as a native executable with the whole compile-and-link cost in front of it.

## Rebuild

This version has two compile errors. Get it to print `starting`. You can't delete the variable on line 13, and you have to decide what to do about `os`.

## Challenge

The starter has four compile errors. Make it compile, then make it *correct*: the hidden tests check exact results, including a mean that isn't a whole number and the empty slice.

## Stretch

Run `go build -x -o app .` locally and read the output. Find the line that runs `compile` and the line that runs `link`. How many packages does a program that only imports `fmt` pull in? Then run it again and see which steps disappear because of the cache.
