package main

import "time"

// NextRun returns when a job scheduled "every day at hour:minute" in loc next
// runs, strictly after now. now can be in any location. The result is in loc.
//
// "Every day at 09:00" means 09:00 on the wall clock in loc, so across a
// daylight saving change the gap between runs is 23 or 25 hours, not 24.
func NextRun(now time.Time, hour, minute int, loc *time.Location) time.Time {
	// Read the calendar date where the job lives, not where now happens to be.
	local := now.In(loc)
	y, m, d := local.Date()
	next := time.Date(y, m, d, hour, minute, 0, 0, loc)
	if !next.After(now) {
		// Next calendar day at the same wall-clock time. time.Date normalizes
		// d+1 past the end of a month or year, and applies loc's offset for
		// that day, which is what makes DST days come out right. Adding 24h
		// would keep the old offset's hour.
		next = time.Date(y, m, d+1, hour, minute, 0, 0, loc)
	}
	return next
}
