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
	return t.Format("YYYY-MM-DD hh:mm")
}
