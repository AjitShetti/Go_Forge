---
{
  "slug": "time",
  "title": "time is harder than it looks",
  "concepts": ["time"],
  "requires": [],
  "trap": {
    "concept": "time",
    "question": "local is utc converted to IST with In. Same instant, different zone. What do == and Equal say?",
    "kind": "choice",
    "choices": [
      "true true\n2026-09-15T15:30:00+05:30",
      "false true\n2026-09-15T15:30:00+05:30",
      "false false\n2026-09-15T15:30:00+05:30",
      "true true\n2026-09-15T10:00:00Z"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `2026-03-07 09:05`. main (lines 8–11) is locked.",
    "lockedLines": [8, 9, 10, 11]
  },
  "challenge": {
    "prompt": "Write `NextRun(now, hour, minute, loc)`: the next daily run at that wall-clock time in loc, strictly after now, correct across time zones, month and year ends, and daylight saving changes.",
    "entry": "starter.go"
  }
}
---

## Provoke

`utc` is 10:00 UTC. `local` is the same moment shown in India Standard Time, 15:30. Nothing about *when* it is has changed.

## Decode

### A time.Time is an instant plus a way of showing it

A `time.Time` holds:

- the **instant**: seconds and nanoseconds since an epoch, the absolute point on the timeline
- a pointer to a **`*time.Location`**: which zone to use when turning that instant into a calendar date and clock time
- sometimes a **monotonic clock reading**, but only on values from `time.Now()`

`t.In(loc)` returns a copy with a different location pointer and the same instant. `==` compares the struct field by field, so a different location pointer makes it `false`, and so does a monotonic reading that one side has and the other doesn't. **`t.Equal(u)` compares instants**, which is the question you almost always mean. The same applies to using `time.Time` as a map key: two keys for one instant.

### Durations versus calendar arithmetic

- `t.Add(24 * time.Hour)` adds exactly 86,400 seconds to the instant.
- `t.AddDate(0, 0, 1)` or `time.Date(y, m, d+1, ...)` moves the **calendar**: same wall-clock time, next day, in `t`'s location. The zone rules then decide the offset for that day.

On a day when clocks change, those disagree by an hour. Calendar arithmetic also **normalizes** out-of-range fields: January 31 plus one month is "February 31", which is March 3.

```go verified id=calendar-vs-duration
package main

import (
	"fmt"
	"time"
	_ "time/tzdata"
)

func main() {
	ny, err := time.LoadLocation("America/New_York")
	fmt.Println(err)
	before := time.Date(2026, 3, 7, 9, 0, 0, 0, ny)
	fmt.Println(before.Add(24 * time.Hour).Format("Jan 2 15:04 MST"))
	fmt.Println(before.AddDate(0, 0, 1).Format("Jan 2 15:04 MST"))
	fmt.Println(time.Date(2026, 3, 8, 2, 30, 0, 0, ny).Format("15:04 MST"))
	d := time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC).AddDate(0, 1, 0)
	fmt.Println(d.Format(time.DateOnly))
}
```

On March 8, 2026, New York skips 02:00–03:00. Twenty-four hours after 09:00 EST is 10:00 EDT, while "same time tomorrow" is 09:00 EDT. A wall time inside the gap, 02:30, doesn't exist, and `time.Date` picks one of the adjacent times; the documentation doesn't promise which. `import _ "time/tzdata"` embeds the zone database in the binary, so `LoadLocation` works even where the OS has none (containers, Windows, the browser).

### Layouts use a reference time, not letters

`Format` and `Parse` don't use `YYYY-MM-DD`. They use one fixed moment, **Mon Jan 2 15:04:05 MST 2006** (1 2 3 4 5 6 7 in American order: month 1, day 2, hour 3 PM, minute 4, second 5, year 6, zone offset -7), written the way you want yours to look. `2006-01-02 15:04` means year-month-day hour:minute. Anything that isn't part of the reference time, like `YYYY` or `hh`, is copied through literally, which is the Rebuild. `time.RFC3339`, `time.DateOnly` and `time.DateTime` are predefined layouts.

## Python/JS contrast

- **Python**: `datetime` comparison between aware datetimes compares instants, so `utc_dt == ist_dt` is `True`, the opposite of Go's `==`. `timedelta(days=1)` on an aware datetime adds to the wall clock without applying new DST offsets, a different bug from Go's `Add`. `strftime` uses `%Y-%m-%d` codes.
- **JavaScript**: `Date` holds only a millisecond instant plus the host's local zone, so there's no per-value location at all. `setDate(d + 1)` does calendar arithmetic in local time. Formats come from `Intl.DateTimeFormat`, or libraries using `YYYY-MM-DD` tokens, which is exactly what Go doesn't accept.
- **False friend:** `YYYY-MM-DD` in a Go layout isn't an error. It just prints the letters.

## Rebuild

`stamp` formats with a layout that looks right to anyone who has used another language. `main` is locked.

## Challenge

`NextRun` schedules a daily job by wall-clock time. The hidden tests cover later today, already passed, exactly at the run time, New Year's Eve, a UTC server with a job in Kolkata, and New York's spring-forward and fall-back days, where the right answer is 23 and 25 hours away.

## Stretch

Run `start := time.Now(); time.Sleep(time.Second); fmt.Println(time.Since(start))` locally while you change the system clock by an hour in the middle. Why does the elapsed time still come out near one second? Then print `start` with `%v` and find the `m=+...` monotonic reading, and explain why `start.Round(0)` removes it.
