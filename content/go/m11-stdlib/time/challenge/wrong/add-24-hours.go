package main

import "time"

// Right date and location, but "tomorrow" is 24 hours later. On the night the
// clocks change, that lands an hour off the wall-clock time.
func NextRun(now time.Time, hour, minute int, loc *time.Location) time.Time {
	local := now.In(loc)
	y, m, d := local.Date()
	next := time.Date(y, m, d, hour, minute, 0, 0, loc)
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return next
}
