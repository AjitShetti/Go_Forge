package main

import (
	"fmt"
	"time"
)

func main() {
	utc := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)
	ist := time.FixedZone("IST", 5*60*60+30*60)
	local := utc.In(ist)
	fmt.Println(utc == local, utc.Equal(local))
	fmt.Println(local.Format(time.RFC3339))
}
