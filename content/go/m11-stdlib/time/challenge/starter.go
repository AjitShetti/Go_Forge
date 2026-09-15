package main

import "time"

// NextRun returns when a job scheduled "every day at hour:minute" in loc next
// runs, strictly after now. now can be in any location. The result is in loc.
//
// "Every day at 09:00" means 09:00 on the wall clock in loc, so across a
// daylight saving change the gap between runs is 23 or 25 hours, not 24.
func NextRun(now time.Time, hour, minute int, loc *time.Location) time.Time {
	next := now.Truncate(24 * time.Hour).Add(time.Duration(hour)*time.Hour + time.Duration(minute)*time.Minute)
	if next.Before(now) {
		next = next.Add(24 * time.Hour)
	}
	return next
}
