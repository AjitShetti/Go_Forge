package main

import (
	"math"
	"testing"
)

// The shapes live here, in the test file: Summary can't name them, only ask
// what they can do.

type square struct{ side float64 }

func (s square) Area() float64      { return s.side * s.side }
func (s square) Perimeter() float64 { return 4 * s.side }

type circle struct{ r float64 }

func (c *circle) Area() float64      { return math.Pi * c.r * c.r }
func (c *circle) Perimeter() float64 { return 2 * math.Pi * c.r }

// blob has an area but no perimeter.
type blob struct{ area float64 }

func (b blob) Area() float64 { return b.area }

// badge has a Perimeter method with a different signature: not the capability.
type badge struct{}

func (badge) Area() float64     { return 1 }
func (badge) Perimeter() string { return "dotted" }

func TestSummary(t *testing.T) {
	cases := []struct {
		name   string
		shapes []Shape
		want   string
	}{
		{"no shapes", nil, ""},
		{"square has a perimeter", []Shape{square{2}}, "area 4.00, perimeter 8.00"},
		{"blob has none", []Shape{blob{3.5}}, "area 3.50"},
		{"pointer receiver methods", []Shape{&circle{1}}, "area 3.14, perimeter 6.28"},
		{"wrong signature is not a perimeter", []Shape{badge{}}, "area 1.00"},
		{"mixed, one per line", []Shape{blob{1}, square{1}, blob{2}}, "area 1.00\narea 1.00, perimeter 4.00\narea 2.00"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Summary(c.shapes); got != c.want {
				t.Errorf("Summary =\n%s\nwant\n%s", got, c.want)
			}
		})
	}
}
