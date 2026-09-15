package main

import "time"

// Uses Before, so when now is exactly the run time it returns now itself:
// a job that just ran would run again immediately.
func NextRun(now time.Time, hour, minute int, loc *time.Location) time.Time {
	local := now.In(loc)
	y, m, d := local.Date()
	next := time.Date(y, m, d, hour, minute, 0, 0, loc)
	if next.Before(now) {
		next = time.Date(y, m, d+1, hour, minute, 0, 0, loc)
	}
	return next
}
