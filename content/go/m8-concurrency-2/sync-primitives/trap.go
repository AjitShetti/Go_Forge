package main

import (
	"fmt"
	"sync"
)

type Cache struct {
	mu    sync.Mutex
	items map[string]string
}

func (c *Cache) Has(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.items[key]
	return ok
}

func (c *Cache) GetOrSet(key, value string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.Has(key) {
		c.items[key] = value
	}
	return c.items[key]
}

func main() {
	c := &Cache{items: map[string]string{}}
	fmt.Println(c.GetOrSet("lang", "go"))
}
