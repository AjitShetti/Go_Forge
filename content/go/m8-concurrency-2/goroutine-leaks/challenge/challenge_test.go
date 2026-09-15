package main

import (
	"context"
	"runtime"
	"testing"
	"time"
)

// baseline returns the goroutine count once earlier goroutines have settled.
// It sleeps first, so a timer has fired before counting in every environment.
func baseline() int {
	time.Sleep(30 * time.Millisecond)
	return runtime.NumGoroutine()
}

// closedWithin drains ch until it's closed or d passes.
func closedWithin(ch <-chan int, d time.Duration) bool {
	deadline := time.After(d)
	for {
		select {
		case _, ok := <-ch:
			if !ok {
				return true
			}
		case <-deadline:
			return false
		}
	}
}

func TestNumbers(t *testing.T) {
	t.Run("counts from zero", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		ch := Numbers(ctx)
		for want := 0; want < 5; want++ {
			if got := <-ch; got != want {
				t.Fatalf("value %d = %d", want, got)
			}
		}
	})
	t.Run("closes after cancel", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		ch := Numbers(ctx)
		<-ch
		<-ch
		cancel()
		if !closedWithin(ch, 200*time.Millisecond) {
			t.Fatal("channel still open 200ms after cancel: a reader ranging over it would never finish")
		}
	})
	t.Run("stops when nobody is reading", func(t *testing.T) {
		before := baseline()
		ctx, cancel := context.WithCancel(context.Background())
		ch := Numbers(ctx)
		<-ch
		<-ch
		<-ch
		time.Sleep(20 * time.Millisecond) // the producer is now blocked sending the next value
		cancel()                          // and the reader walks away without reading again
		time.Sleep(50 * time.Millisecond)
		if n := runtime.NumGoroutine() - before; n > 0 {
			t.Fatalf("%d goroutine(s) still running after cancel with no reader: the producer is stuck", n)
		}
	})
	t.Run("already cancelled", func(t *testing.T) {
		before := baseline()
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		ch := Numbers(ctx)
		time.Sleep(50 * time.Millisecond)
		if n := runtime.NumGoroutine() - before; n > 0 {
			t.Fatalf("%d goroutine(s) still running for a context that was cancelled from the start", n)
		}
		if !closedWithin(ch, 200*time.Millisecond) {
			t.Fatal("channel never closed")
		}
	})
}
