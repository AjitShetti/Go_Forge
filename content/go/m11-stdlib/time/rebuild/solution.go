package main

import (
	"fmt"
	"time"
)

func main() {
	t := time.Date(2026, 3, 7, 9, 5, 0, 0, time.UTC)
	fmt.Println(stamp(t))
}

// stamp formats t like "2026-03-07 09:05".
func stamp(t time.Time) string {
	// A layout is the reference time Mon Jan 2 15:04:05 MST 2006, written the
	// way you want yours to look: 2006 is the year, 01 the month, 02 the day,
	// 15 the 24-hour hour, 04 the minute.
	return t.Format("2006-01-02 15:04")
}
