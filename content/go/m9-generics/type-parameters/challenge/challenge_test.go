package main

import (
	"slices"
	"strings"
	"testing"
)

type CustomerID string

type order struct {
	customer CustomerID
	total    float64
}

func TestGroupBy(t *testing.T) {
	t.Run("strings by length", func(t *testing.T) {
		got := GroupBy([]string{"go", "rust", "c", "zig", "java", "js"}, func(s string) int { return len(s) })
		if !slices.Equal(got[2], []string{"go", "js"}) || !slices.Equal(got[4], []string{"rust", "java"}) || len(got) != 4 {
			t.Fatalf("GroupBy = %v", got)
		}
	})
	t.Run("structs by a named string key", func(t *testing.T) {
		orders := []order{{"ana", 10}, {"bo", 5}, {"ana", 7}, {"ana", 1}}
		got := GroupBy(orders, func(o order) CustomerID { return o.customer })
		want := []order{{"ana", 10}, {"ana", 7}, {"ana", 1}}
		if !slices.Equal(got["ana"], want) || len(got["bo"]) != 1 {
			t.Fatalf("GroupBy = %v", got)
		}
	})
	t.Run("ints by a bool key", func(t *testing.T) {
		got := GroupBy([]int{5, 2, 8, 3}, func(n int) bool { return n%2 == 0 })
		if !slices.Equal(got[true], []int{2, 8}) || !slices.Equal(got[false], []int{5, 3}) {
			t.Fatalf("GroupBy = %v", got)
		}
	})
	t.Run("empty input", func(t *testing.T) {
		if got := GroupBy([]float64(nil), func(f float64) int { return int(f) }); len(got) != 0 {
			t.Fatalf("GroupBy(nil) = %v", got)
		}
	})
}

func TestSortedKeys(t *testing.T) {
	t.Run("int keys", func(t *testing.T) {
		m := map[int]string{}
		for _, k := range []int{42, 7, -3, 19, 0, 100, 8, 55, 23, 61} {
			m[k] = "x"
		}
		if got := SortedKeys(m); !slices.Equal(got, []int{-3, 0, 7, 8, 19, 23, 42, 55, 61, 100}) {
			t.Fatalf("SortedKeys = %v", got)
		}
	})
	t.Run("named string keys", func(t *testing.T) {
		m := map[CustomerID][]order{}
		for _, id := range strings.Fields("mia ana zoe bo lee kim dan eve ivy fay") {
			m[CustomerID(id)] = nil
		}
		want := []CustomerID{"ana", "bo", "dan", "eve", "fay", "ivy", "kim", "lee", "mia", "zoe"}
		if got := SortedKeys(m); !slices.Equal(got, want) {
			t.Fatalf("SortedKeys = %v", got)
		}
	})
	t.Run("float keys", func(t *testing.T) {
		m := map[float64]bool{2.5: true, -1: true, 0.25: true, 10: true, 3.75: true, 1e3: true, 0.5: true, 7: true, 6.5: true, 4: true}
		want := []float64{-1, 0.25, 0.5, 2.5, 3.75, 4, 6.5, 7, 10, 1000}
		if got := SortedKeys(m); !slices.Equal(got, want) {
			t.Fatalf("SortedKeys = %v", got)
		}
	})
}
