package main

import "time"

// Builds the run time in now's location instead of loc, so a UTC server
// schedules "09:00" for 09:00 UTC.
func NextRun(now time.Time, hour, minute int, loc *time.Location) time.Time {
	y, m, d := now.Date()
	next := time.Date(y, m, d, hour, minute, 0, 0, now.Location())
	if !next.After(now) {
		next = time.Date(y, m, d+1, hour, minute, 0, 0, now.Location())
	}
	return next.In(loc)
}
