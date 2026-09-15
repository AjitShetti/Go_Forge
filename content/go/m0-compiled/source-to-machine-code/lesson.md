---
{
  "slug": "source-to-machine-code",
  "title": "Tokens, AST, types, SSA, machine code",
  "concepts": ["compiler-pipeline"],
  "requires": [],
  "trap": {
    "concept": "compiler-pipeline",
    "question": "A normal hello world, except main's opening brace is on its own line. What happens?",
    "kind": "choice",
    "choices": [
      "hello",
      "hello, plus a gofmt style warning",
      "./main.go:6:1: syntax error: unexpected semicolon or newline before {",
      "./main.go:5:6: missing function body"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it print `[python javascript go]`. Lines 7 and 8 are locked.",
    "lockedLines": [7, 8]
  },
  "challenge": {
    "prompt": "Use the standard library's Go scanner (`go/scanner`) to count how many semicolons it inserts into a piece of source. Semicolons written in the source don't count.",
    "entry": "starter.go"
  }
}
---

## Provoke

In a lot of languages, where the brace goes is a style argument. Here's `main` with its brace on the next line.

## Decode

### Stage 1: the scanner, and a semicolon you never wrote

A compiler reads your file as a stream of **tokens**: `func`, `main`, `(`, `)`, `{`, and so on. Go's grammar ends statements with semicolons. You don't type them because the **scanner inserts them**, following one mechanical rule from the spec:

> When the last token on a line is an identifier, a literal, one of the keywords `break` `continue` `fallthrough` `return`, or one of `++` `--` `)` `]` `}`, the scanner puts a semicolon after it.

`func main()` ends in `)`, so the scanner emits `;` at the newline. The parser then sees `func main();` followed by `{`, and `{` can't start anything in that position. The rule only looks at the last token of the line, never at what you meant.

You can watch it happen. The standard library has a scanner that follows the same rule (`go/scanner`, the one `gofmt` and editors use):

```go verified id=scan-tokens
package main

import (
	"fmt"
	"go/scanner"
	"go/token"
)

func main() {
	src := []byte("func main()\n{\n")
	fset := token.NewFileSet()
	file := fset.AddFile("main.go", fset.Base(), len(src))
	var s scanner.Scanner
	s.Init(file, src, nil, 0)
	for {
		_, tok, lit := s.Scan()
		if tok == token.EOF {
			break
		}
		fmt.Printf("%-6s %q\n", tok, lit)
	}
}
```

The `;` token with literal `"\n"` right after `)` is the inserted semicolon. It's the one the error message complains about.

The same rule is behind the Rebuild: the string literal `"go"` at the end of a line gets a semicolon too, which is why Go needs a trailing comma in multi-line literals.

### The rest of the pipeline

The trap failed in the scanner, so nothing after it ran. A program that gets through goes through `gc`, the compiler (`cmd/compile`; it has its own internal scanner and parser that follow the same spec) in this order:

1. **Scan** bytes into tokens, inserting semicolons.
2. **Parse** the tokens into a syntax tree (AST), such as `FuncDecl{Name: main, Body: Block{...}}`. Syntax errors stop here.
3. **Type-check** the tree. Every identifier is resolved to a declaration and every expression gets a type. "declared and not used" and "mismatched types" come from this stage.
4. **Lower to IR and optimize**: inline small functions, run escape analysis (module M2), rewrite `range` loops as plain loops.
5. **SSA** (static single assignment): every value is assigned exactly once, which keeps optimizations like dead-code removal and bounds-check elimination simple. Architecture-independent passes run first, then the code is lowered to one architecture's instructions.
6. **Emit machine code** into an object file per package. Then the **linker** combines all the packages and the runtime into one executable.

In this app, step 6 targets WebAssembly instead of x86 or ARM. Steps 1–5 are the same compiler code a local `go build` runs.

To look at a function's SSA, run `GOSSAFUNC=main go build` locally. It writes an `ssa.html` file that shows every pass side by side.

## Python/JS contrast

- **Python**'s tokenizer also turns newlines into tokens (`NEWLINE`, plus `INDENT`/`DEDENT`), so line structure is part of Python's grammar too. The difference is what counts: Python cares about indentation, Go cares about the *last token on the line*, and Go's compiler ignores indentation.
- **JavaScript** has automatic semicolon insertion (ASI) too, but JS mainly inserts a semicolon when the next token *would otherwise be an error*. That's why `return` with `{ ok: true }` on the following line quietly returns `undefined`, and why JS style guides argue about semicolons. Go's rule never looks at the next token, and because it's that simple, every Go file puts braces in the same place.
- **False friend:** "Go has no semicolons." It has plenty. The scanner writes them for you, and gofmt's brace style is simply the only layout the grammar accepts.

## Rebuild

A multi-line slice literal that doesn't compile. The data lines are locked. Work out which token got a semicolon it shouldn't have.

## Challenge

Write `InsertedSemicolons(src)` using `go/scanner`. The hidden tests use short snippets covering end of file, calls, `return`, `++`, trailing commas, comments and blank lines. Your job is to tell a semicolon the scanner inserted apart from one someone typed.

## Stretch

The insertion rule lists `)` `]` `}`, but not `,` or `{`. For each of those two, write a line of everyday Go that would break if a semicolon were inserted after it. Then work out why a multi-line method chain in Go has to end each line with the `.`, and can't start the next line with it.
