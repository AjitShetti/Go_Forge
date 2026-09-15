package main

type Cache interface {
	Get(key string) (string, bool)
	GetOr(key, def string) string
	Set(key, value string)
}

type CountingCache struct {
	Cache
	Hits, Misses int
}

// Counts on a copy of CountingCache, so Hits and Misses never change.
func (c CountingCache) Get(key string) (string, bool) {
	v, ok := c.Cache.Get(key)
	if ok {
		c.Hits++
	} else {
		c.Misses++
	}
	return v, ok
}

func (c CountingCache) GetOr(key, def string) string {
	if v, ok := c.Get(key); ok {
		return v
	}
	return def
}
