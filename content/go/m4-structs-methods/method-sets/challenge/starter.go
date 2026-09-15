package main

// Metric summarizes a stream of observations.
type Metric interface {
	Observe(v float64)
	Count() int
	Mean() float64
}

// Meter is a Metric. Its zero value is an empty meter.
type Meter struct {
	n   int
	sum float64
}

// NewMeter returns a new, empty Metric.
func NewMeter() Metric {
	return Meter{}
}

func (m Meter) Observe(v float64) {
	m.n++
	m.sum += v
}

func (m Meter) Count() int {
	return m.n
}

// Mean is the average observation, or 0 when there are none.
func (m Meter) Mean() float64 {
	if m.n == 0 {
		return 0
	}
	return m.sum / float64(m.n)
}
