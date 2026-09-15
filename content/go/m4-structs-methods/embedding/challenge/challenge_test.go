package main

import "testing"

// mapCache is the inner cache the tests wrap. Its GetOr calls its own Get.
type mapCache map[string]string

func (m mapCache) Get(key string) (string, bool) {
	v, ok := m[key]
	return v, ok
}

func (m mapCache) GetOr(key, def string) string {
	if v, ok := m.Get(key); ok {
		return v
	}
	return def
}

func (m mapCache) Set(key, value string) {
	m[key] = value
}

func TestCountingCache(t *testing.T) {
	t.Run("is a Cache", func(t *testing.T) {
		var c Cache = &CountingCache{Cache: mapCache{}}
		c.Set("a", "1")
		if v, ok := c.Get("a"); !ok || v != "1" {
			t.Fatalf(`Get("a") = %q, %v; want "1", true`, v, ok)
		}
	})
	t.Run("Set passes through", func(t *testing.T) {
		inner := mapCache{}
		c := &CountingCache{Cache: inner}
		c.Set("k", "v")
		if inner["k"] != "v" {
			t.Fatalf("inner cache after Set: %v, want k=v", inner)
		}
	})
	t.Run("Get counts hits and misses", func(t *testing.T) {
		c := &CountingCache{Cache: mapCache{"a": "1"}}
		c.Get("a")
		c.Get("a")
		c.Get("zz")
		if c.Hits != 2 || c.Misses != 1 {
			t.Fatalf("Hits=%d Misses=%d, want 2 and 1", c.Hits, c.Misses)
		}
	})
	t.Run("GetOr counts too", func(t *testing.T) {
		c := &CountingCache{Cache: mapCache{"a": "1"}}
		if got := c.GetOr("a", "x"); got != "1" {
			t.Fatalf(`GetOr("a", "x") = %q, want "1"`, got)
		}
		if got := c.GetOr("b", "x"); got != "x" {
			t.Fatalf(`GetOr("b", "x") = %q, want "x"`, got)
		}
		if c.Hits != 1 || c.Misses != 1 {
			t.Fatalf("after one GetOr hit and one miss: Hits=%d Misses=%d, want 1 and 1", c.Hits, c.Misses)
		}
	})
	t.Run("counted through the interface", func(t *testing.T) {
		cc := &CountingCache{Cache: mapCache{"a": "1"}}
		var c Cache = cc
		c.Get("a")
		c.GetOr("nope", "")
		if cc.Hits != 1 || cc.Misses != 1 {
			t.Fatalf("Hits=%d Misses=%d, want 1 and 1", cc.Hits, cc.Misses)
		}
	})
}
