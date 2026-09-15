package main

import "fmt"

type Counter struct{ n int }

func (c Counter) Inc() { c.n++ }

func (c *Counter) IncPtr() { c.n++ }

func main() {
	var c Counter
	c.Inc()
	c.Inc()
	c.IncPtr()
	fmt.Println(c.n)

	p := &c
	p.Inc()
	fmt.Println(c.n)
}
