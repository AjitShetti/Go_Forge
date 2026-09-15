package main

import (
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestClassify(t *testing.T) {
	limited := &RateLimitError{RetryAfter: 2 * time.Second}
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"nil", nil, "ok"},
		{"bare sentinel", ErrNotFound, "not-found"},
		{"bare typed error", limited, "retry after 2s"},
		{"wrapped once with %w", fmt.Errorf("get user: %w", ErrNotFound), "not-found"},
		{"wrapped three times", fmt.Errorf("handler: %w", fmt.Errorf("service: %w", fmt.Errorf("repo: %w", limited))), "retry after 2s"},
		{"inside OpError", &OpError{Op: "select", Err: ErrNotFound}, "not-found"},
		{"OpError inside %w", fmt.Errorf("list: %w", &OpError{Op: "fetch", Err: limited}), "retry after 2s"},
		{"joined with another error", errors.Join(errors.New("cache miss"), fmt.Errorf("db: %w", ErrNotFound)), "not-found"},
		{"wrapped with %v loses the chain", fmt.Errorf("get user: %v", ErrNotFound), "internal"},
		{"same text is not the sentinel", errors.New("not found"), "internal"},
		{"plain error", errors.New("boom"), "internal"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Classify(c.err); got != c.want {
				t.Errorf("Classify(%v) = %q, want %q", c.err, got, c.want)
			}
		})
	}
}

func TestOpErrorMessage(t *testing.T) {
	err := &OpError{Op: "select", Err: ErrNotFound}
	if err.Error() != "select: not found" {
		t.Errorf("Error() = %q, want %q", err.Error(), "select: not found")
	}
}
