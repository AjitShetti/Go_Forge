---
{
  "slug": "vet-gofmt-modules",
  "title": "go vet, gofmt, modules",
  "concepts": ["tooling", "modules"],
  "requires": [],
  "trap": {
    "concept": "tooling",
    "question": "go/format is gofmt as a library. It formats a function whose body is `return a*b+c*(a-b)`. What does the formatted return line look like?",
    "kind": "choice",
    "choices": [
      "return a * b + c * (a - b) <nil>",
      "return a*b + c*(a-b) <nil>",
      "return a*b+c*(a-b) <nil>",
      "return (a * b) + (c * (a - b)) <nil>"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print the formatted `Total` function instead of `gofmt refused`. main (lines 8–15) is locked; change only `src`.",
    "lockedLines": [8, 9, 10, 11, 12, 13, 14, 15]
  },
  "challenge": {
    "prompt": "Write `Unformatted(files)`, a tiny `gofmt -l`: the sorted names of files that gofmt would change, byte for byte, with unparseable files reported as `name (syntax error)`.",
    "entry": "starter.go"
  }
}
---

## Provoke

`go/format.Source` is the same code the `gofmt` command runs. The input has no spaces at all around the operators in `a*b+c*(a-b)`. The program prints the formatted `return` line and the error.

## Decode

### gofmt formats a syntax tree, not text

gofmt doesn't apply spacing rules to characters. It **parses** the file into an AST, throws away the original whitespace, and prints the tree again with one fixed layout. Tabs indent, and blank lines, line breaks inside expressions and comments are kept where they are.

Spacing inside an expression comes from the tree's shape. When a binary expression mixes precedence levels, gofmt drops the spaces around the **tighter-binding** operators and keeps them around the looser ones, so the layout shows how the expression groups: `a*b + c*(a-b)`. Inside the parentheses, `a-b` is its own tree, so it loses its spaces too. An expression with one precedence level gets spaces everywhere: `a + b + c`.

Because it works on the tree, gofmt **must parse the file** (the Rebuild), and because it only parses, it never type-checks. Unused imports and undefined names format just fine:

```go verified id=gofmt-cases
package main

import (
	"fmt"
	"go/format"
)

func main() {
	for _, src := range []string{
		"package p\nvar x=1",
		"package p\n\nvar x = 1\n",
		"package p\nfunc f() {",
		"package p\nimport \"os\"\nvar unused = 1\n",
	} {
		out, err := format.Source([]byte(src))
		fmt.Printf("%q %v\n", out, err)
	}
}
```

There are **no options**. No tab width, no brace style, no line length. That's the point: every Go file in the world looks the same, diffs contain only real changes, and nobody argues in code review about formatting. Editors run it on save, and CI runs `gofmt -l .` and fails if it lists anything, which is the Challenge.

### go vet: compiles, but is probably wrong

`go vet` runs **analyzers** over type-checked code and reports things that compile but are almost certainly bugs: `fmt.Printf("%d", "text")`, copying a `sync.Mutex` (M4, M8), a `cancel` func from `context.WithCancel` that's never called (M8), unreachable code, self-assignment, struct tags with typos.

`go test` runs a **high-confidence subset** automatically before running your tests (`atomic`, `bools`, `buildtag`, `directive`, `errorsas`, `ifaceassert`, `nilfunc`, `printf`, `stdversion`, `stringintconv`, `tests`). If one fires, the tests don't run. That's why an `errors.As` target that isn't a pointer to an error type fails `go test` at build time.

**Engine note:** `go vet` and the `gofmt` command need the go command, which the browser engine doesn't include. This lesson's programs call `go/format` directly, which is the same formatter. Run `gofmt -l .` and `go vet ./...` locally to see the tools themselves.

### Modules: the go.mod file is the build's source of truth

A **module** is a tree of packages with a `go.mod` at its root:

```
module example.com/shop

go 1.24

require (
	github.com/google/uuid v1.6.0
	golang.org/x/sync v0.10.0
)
```

- `module` is the import path prefix for its packages.
- `go` is the **language version** for this module's code. It decided loop-variable semantics in M7, and it's the minimum toolchain needed to build.
- `require` lists dependency versions. `go.sum` records a cryptographic hash of each one, so a changed download is detected.

When two dependencies need different versions of the same module, Go uses **minimal version selection**: for each module it picks the **highest of the minimum versions** anyone requires, and never a newer release that nobody asked for:

```
you      requires  A v1.2.0,  B v1.0.0
B v1.0.0 requires  A v1.5.0
A v1.9.0 exists
build uses A v1.5.0
```

No lock file is needed, because the result is determined by the `go.mod` files alone, and a new release upstream can't change your build until someone runs `go get` (which edits `go.mod`). `go mod tidy` adds what's imported and removes what isn't.

## Python/JS contrast

- **Python**: `black` is the closest thing to gofmt, deliberately nearly option-less, but it isn't built into the language toolchain. `ruff`/`pylint` are vet's cousins. Packaging picks the **newest** version satisfying constraints (`requests>=2.0`), so builds drift unless you pin with a lock file.
- **JavaScript**: Prettier is option-light but still configurable. npm's `^1.2.0` ranges also resolve to the newest match, which is why `package-lock.json` exists. Go's MVS makes that lock-file role unnecessary.
- **False friend:** "gofmt is a linter". It never tells you your code is wrong. It only prints it the one way.

## Rebuild

`main` hands `src` to gofmt and prints the result, but gofmt refuses. `main` is locked: fix the source so there's a file gofmt can parse, and let gofmt do the rest.

## Challenge

`Unformatted` checks a map of file names to contents, the way `gofmt -l` checks a directory. The hidden tests include wrong operator spacing, space indentation, a missing final newline, trailing blank lines, an unparseable file, an unused import that's still perfectly formatted, and a six-file report that has to come back sorted.

## Stretch

In a scratch module, `go get golang.org/x/sync@v0.9.0`, then add a dependency that requires a newer `x/sync`, and read `go mod graph` and `go list -m all`. Which version did MVS choose, and what does `go mod why golang.org/x/sync` say about who needs it?
