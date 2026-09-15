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

// Looks like it overrides every lookup, but GetOr is still promoted from the
// inner cache, and the inner GetOr calls the inner Get.
func (c *CountingCache) Get(key string) (string, bool) {
	v, ok := c.Cache.Get(key)
	if ok {
		c.Hits++
	} else {
		c.Misses++
	}
	return v, ok
}
