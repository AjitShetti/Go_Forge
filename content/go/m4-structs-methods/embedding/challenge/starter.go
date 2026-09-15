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
