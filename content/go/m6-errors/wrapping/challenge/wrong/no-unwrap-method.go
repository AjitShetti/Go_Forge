package main

import (
	"errors"
	"fmt"
	"time"
)

// ErrNotFound means the thing asked for doesn't exist.
var ErrNotFound = errors.New("not found")

// RateLimitError means the caller must wait before retrying.
type RateLimitError struct {
	RetryAfter time.Duration
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("rate limited, retry after %v", e.RetryAfter)
}

// OpError adds the name of the operation that failed to an underlying error.
type OpError struct {
	Op  string
	Err error
}

func (e *OpError) Error() string {
	return e.Op + ": " + e.Err.Error()
}

// Classify turns any error into a response category:
//   - nil: "ok"
//   - ErrNotFound anywhere in the chain: "not-found"
//   - a *RateLimitError anywhere in the chain: "retry after " + RetryAfter
//   - anything else: "internal"
//
// Errors arrive wrapped: by fmt.Errorf with %w, by *OpError, by errors.Join,
// several layers deep.
func Classify(err error) string {
	if err == nil {
		return "ok"
	}
	// Right functions, but *OpError has no Unwrap, so the chain stops there.
	if errors.Is(err, ErrNotFound) {
		return "not-found"
	}
	var rl *RateLimitError
	if errors.As(err, &rl) {
		return "retry after " + rl.RetryAfter.String()
	}
	return "internal"
}
