package main

// Cache is a string key-value cache. GetOr returns def when key is missing.
type Cache interface {
	Get(key string) (string, bool)
	GetOr(key, def string) string
	Set(key, value string)
}

// CountingCache wraps another Cache and counts lookups. Every lookup, through
// Get or GetOr, is a hit when the key exists and a miss when it doesn't.
// Set passes straight through.
type CountingCache struct {
	Cache
	Hits, Misses int
}

// Get shadows the embedded Get. Pointer receiver: the counts live in c.
func (c *CountingCache) Get(key string) (string, bool) {
	v, ok := c.Cache.Get(key)
	if ok {
		c.Hits++
	} else {
		c.Misses++
	}
	return v, ok
}

// GetOr must be overridden too. The promoted c.Cache.GetOr would call the
// inner cache's own Get, which knows nothing about CountingCache.
func (c *CountingCache) GetOr(key, def string) string {
	if v, ok := c.Get(key); ok {
		return v
	}
	return def
}
