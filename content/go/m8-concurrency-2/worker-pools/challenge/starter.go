package main

// ProcessAll runs work on every item, with at most limit calls to work
// running at the same time (limit >= 1), and returns the results in the same
// order as items.
//
// work is slow (think: resizing an image), so ProcessAll should actually use
// its limit: with 12 items and a limit of 4, it should take about 3 times as
// long as one call, not 12 times.
func ProcessAll(items []string, limit int, work func(string) string) []string {
	out := make([]string, 0, len(items))
	for _, it := range items {
		out = append(out, work(it))
	}
	return out
}
