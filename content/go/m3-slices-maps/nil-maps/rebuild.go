package main

import "fmt"

type Counter struct {
	counts map[string]int
}

func main() {
	var c Counter
	c.Add("go")
	c.Add("go")
	c.Add("python")
	fmt.Println(c.counts["go"], c.counts["python"])
}

func (c *Counter) Add(word string) {
	c.counts[word]++
}
