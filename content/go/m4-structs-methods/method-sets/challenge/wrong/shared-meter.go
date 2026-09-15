package main

type Metric interface {
	Observe(v float64)
	Count() int
	Mean() float64
}

type Meter struct {
	n   int
	sum float64
}

var shared Meter

// Pointer receivers are right, but every caller gets the same Meter.
func NewMeter() Metric {
	return &shared
}

func (m *Meter) Observe(v float64) {
	m.n++
	m.sum += v
}

func (m *Meter) Count() int {
	return m.n
}

func (m *Meter) Mean() float64 {
	if m.n == 0 {
		return 0
	}
	return m.sum / float64(m.n)
}
