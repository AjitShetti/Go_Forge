package main

import (
	"testing"
	"time"
	_ "time/tzdata" // zone rules built in, so the tests don't depend on the OS
)

func mustLoad(t *testing.T, name string) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation(name)
	if err != nil {
		t.Fatalf("LoadLocation(%q): %v", name, err)
	}
	return loc
}

func TestNextRun(t *testing.T) {
	const layout = "2006-01-02 15:04 MST"
	check := func(t *testing.T, got, want time.Time) {
		t.Helper()
		if !got.Equal(want) || got.Location().String() != want.Location().String() {
			t.Fatalf("NextRun = %s (%s), want %s (%s)", got.Format(layout), got.Location(), want.Format(layout), want.Location())
		}
	}

	t.Run("later today", func(t *testing.T) {
		now := time.Date(2026, 5, 4, 7, 30, 0, 0, time.UTC)
		check(t, NextRun(now, 9, 0, time.UTC), time.Date(2026, 5, 4, 9, 0, 0, 0, time.UTC))
	})
	t.Run("already passed today", func(t *testing.T) {
		now := time.Date(2026, 5, 4, 9, 1, 0, 0, time.UTC)
		check(t, NextRun(now, 9, 0, time.UTC), time.Date(2026, 5, 5, 9, 0, 0, 0, time.UTC))
	})
	t.Run("exactly the run time is not after", func(t *testing.T) {
		now := time.Date(2026, 5, 4, 9, 0, 0, 0, time.UTC)
		check(t, NextRun(now, 9, 0, time.UTC), time.Date(2026, 5, 5, 9, 0, 0, 0, time.UTC))
	})
	t.Run("end of year", func(t *testing.T) {
		now := time.Date(2026, 12, 31, 23, 0, 0, 0, time.UTC)
		check(t, NextRun(now, 6, 15, time.UTC), time.Date(2027, 1, 1, 6, 15, 0, 0, time.UTC))
	})
	t.Run("server in UTC, job in Kolkata", func(t *testing.T) {
		kolkata := mustLoad(t, "Asia/Kolkata")
		// 20:00 UTC is 01:30 the next day in Kolkata; 09:00 there is still ahead.
		now := time.Date(2026, 5, 4, 20, 0, 0, 0, time.UTC)
		check(t, NextRun(now, 9, 0, kolkata), time.Date(2026, 5, 5, 9, 0, 0, 0, kolkata))
	})
	t.Run("spring forward keeps the wall clock", func(t *testing.T) {
		ny := mustLoad(t, "America/New_York")
		// Clocks jump from 02:00 EST to 03:00 EDT early on March 8, 2026.
		now := time.Date(2026, 3, 7, 12, 0, 0, 0, ny)
		check(t, NextRun(now, 9, 0, ny), time.Date(2026, 3, 8, 9, 0, 0, 0, ny))
	})
	t.Run("fall back keeps the wall clock", func(t *testing.T) {
		ny := mustLoad(t, "America/New_York")
		// Clocks fall from 02:00 EDT to 01:00 EST early on November 1, 2026.
		now := time.Date(2026, 10, 31, 18, 0, 0, 0, ny)
		check(t, NextRun(now, 17, 30, ny), time.Date(2026, 11, 1, 17, 30, 0, 0, ny))
	})
}
