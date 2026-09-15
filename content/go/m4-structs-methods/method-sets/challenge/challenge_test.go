package main

import "testing"

func TestMeter(t *testing.T) {
	t.Run("empty meter", func(t *testing.T) {
		m := NewMeter()
		if m.Count() != 0 || m.Mean() != 0 {
			t.Fatalf("new meter: Count=%d Mean=%v, want 0 and 0", m.Count(), m.Mean())
		}
	})
	t.Run("observations kept through the interface", func(t *testing.T) {
		m := NewMeter()
		m.Observe(2)
		m.Observe(4)
		m.Observe(9)
		if m.Count() != 3 || m.Mean() != 5 {
			t.Fatalf("after 2, 4, 9: Count=%d Mean=%v, want 3 and 5", m.Count(), m.Mean())
		}
	})
	t.Run("meters are independent", func(t *testing.T) {
		a, b := NewMeter(), NewMeter()
		a.Observe(10)
		if b.Count() != 0 {
			t.Fatalf("observing a changed b: b.Count()=%d, want 0", b.Count())
		}
	})
	t.Run("zero Meter as a struct field", func(t *testing.T) {
		var server struct {
			name    string
			latency Meter
		}
		server.latency.Observe(30)
		server.latency.Observe(50)
		if server.latency.Count() != 2 || server.latency.Mean() != 40 {
			t.Fatalf("field meter: Count=%d Mean=%v, want 2 and 40", server.latency.Count(), server.latency.Mean())
		}
	})
	t.Run("a pointer to Meter is a Metric", func(t *testing.T) {
		var m Metric = &Meter{}
		m.Observe(1)
		if m.Count() != 1 {
			t.Fatalf("Count()=%d, want 1", m.Count())
		}
	})
}
