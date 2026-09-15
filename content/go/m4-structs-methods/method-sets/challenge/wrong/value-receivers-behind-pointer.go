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

// Returning a pointer compiles, because *Meter's method set includes the
// value methods. But a value-receiver Observe still updates a copy.
func NewMeter() Metric {
	return &Meter{}
}

func (m Meter) Observe(v float64) {
	m.n++
	m.sum += v
}

func (m Meter) Count() int {
	return m.n
}

func (m Meter) Mean() float64 {
	if m.n == 0 {
		return 0
	}
	return m.sum / float64(m.n)
}
