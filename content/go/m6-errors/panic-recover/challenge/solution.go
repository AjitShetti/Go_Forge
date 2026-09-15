package main

import (
	"fmt"
	"strconv"
)

// Eval evaluates integer arithmetic: + - * / and parentheses, with the usual
// precedence. Spaces are ignored.
//
// A malformed expression returns an error, never a panic. The parser below
// reports syntax errors by panicking with a parseError, because unwinding
// out of deep recursion is easier than returning errors through every level.
// Eval has to turn exactly those panics into errors.
//
// Any other panic is a real bug or a runtime failure, such as integer
// division by zero, and must keep propagating.
func Eval(expr string) (result int, err error) {
	// recover is called directly by the deferred function: that's the only
	// place it stops a panic. The named results let it set the return values.
	defer func() {
		r := recover()
		if r == nil {
			return
		}
		pe, ok := r.(parseError)
		if !ok {
			panic(r) // not ours: keep unwinding with the original value
		}
		result, err = 0, pe
	}()
	p := &parser{src: expr}
	result = p.expr()
	p.skipSpace()
	if p.pos < len(p.src) {
		p.fail("unexpected %q", p.src[p.pos])
	}
	return result, nil
}

// parseError is the only panic value Eval may recover.
type parseError struct {
	msg string
}

func (e parseError) Error() string {
	return e.msg
}

type parser struct {
	src string
	pos int
}

func (p *parser) fail(format string, args ...any) {
	panic(parseError{fmt.Sprintf("syntax error at position %d: ", p.pos) + fmt.Sprintf(format, args...)})
}

func (p *parser) skipSpace() {
	for p.pos < len(p.src) && p.src[p.pos] == ' ' {
		p.pos++
	}
}

// expr = term { ("+" | "-") term }
func (p *parser) expr() int {
	v := p.term()
	for {
		p.skipSpace()
		if p.pos == len(p.src) || (p.src[p.pos] != '+' && p.src[p.pos] != '-') {
			return v
		}
		op := p.src[p.pos]
		p.pos++
		if op == '+' {
			v += p.term()
		} else {
			v -= p.term()
		}
	}
}

// term = factor { ("*" | "/") factor }
func (p *parser) term() int {
	v := p.factor()
	for {
		p.skipSpace()
		if p.pos == len(p.src) || (p.src[p.pos] != '*' && p.src[p.pos] != '/') {
			return v
		}
		op := p.src[p.pos]
		p.pos++
		if op == '*' {
			v *= p.factor()
		} else {
			v /= p.factor()
		}
	}
}

// factor = number | "(" expr ")"
func (p *parser) factor() int {
	p.skipSpace()
	if p.pos < len(p.src) && p.src[p.pos] == '(' {
		p.pos++
		v := p.expr()
		p.skipSpace()
		if p.pos == len(p.src) || p.src[p.pos] != ')' {
			p.fail("expected )")
		}
		p.pos++
		return v
	}
	start := p.pos
	for p.pos < len(p.src) && p.src[p.pos] >= '0' && p.src[p.pos] <= '9' {
		p.pos++
	}
	if start == p.pos {
		p.fail("expected a number or (")
	}
	n, err := strconv.Atoi(p.src[start:p.pos])
	if err != nil {
		p.fail("%v", err)
	}
	return n
}
