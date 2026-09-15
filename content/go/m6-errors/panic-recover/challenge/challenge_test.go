package main

import (
	"runtime"
	"testing"
)

// call runs Eval and turns a panic that escapes it into a value, so one bad
// case fails that case instead of crashing every test.
func call(expr string) (result int, err error, panicked any) {
	defer func() {
		panicked = recover()
	}()
	result, err = Eval(expr)
	return
}

func TestEval(t *testing.T) {
	t.Run("valid expressions", func(t *testing.T) {
		for _, c := range []struct {
			expr string
			want int
		}{{"1+2*3", 7}, {"(1+2)*3", 9}, {"10/3", 3}, {" 4 - 1 - 1 ", 2}, {"((7))", 7}} {
			got, err, p := call(c.expr)
			if p != nil || err != nil || got != c.want {
				t.Errorf("Eval(%q) = %d, %v (panic: %v); want %d", c.expr, got, err, p, c.want)
			}
		}
	})
	t.Run("syntax errors are returned, not panicked", func(t *testing.T) {
		for _, expr := range []string{"1+", "(2", "2 3", "", "a", "3*)"} {
			got, err, p := call(expr)
			if p != nil {
				t.Errorf("Eval(%q) panicked: %v", expr, p)
				continue
			}
			if err == nil || got != 0 {
				t.Errorf("Eval(%q) = %d, %v; want 0 and an error", expr, got, err)
			}
		}
	})
	t.Run("error message", func(t *testing.T) {
		_, err, p := call("(2")
		want := "syntax error at position 2: expected )"
		if p != nil || err == nil || err.Error() != want {
			t.Errorf("Eval(\"(2\") error = %v (panic: %v), want %q", err, p, want)
		}
	})
	t.Run("division by zero still panics", func(t *testing.T) {
		_, err, p := call("1/0")
		if err != nil {
			t.Fatalf("Eval(\"1/0\") returned error %v: a runtime failure was turned into a syntax error", err)
		}
		if _, ok := p.(runtime.Error); !ok {
			t.Fatalf("Eval(\"1/0\") panic = %#v, want the runtime.Error from dividing by zero", p)
		}
	})
	t.Run("usable after an error", func(t *testing.T) {
		call("((")
		if got, err, p := call("2*21"); got != 42 || err != nil || p != nil {
			t.Errorf("Eval(\"2*21\") after a failure = %d, %v, %v", got, err, p)
		}
	})
}
