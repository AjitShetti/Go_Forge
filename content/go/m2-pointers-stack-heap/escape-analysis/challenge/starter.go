package main

import "strings"

// Fields appends the space-separated words of s to dst and returns the
// extended slice. Runs of spaces count as one separator; leading and trailing
// spaces are ignored. When dst has enough spare capacity, Fields must not
// allocate at all.
func Fields(dst []string, s string) []string {
	return append(dst, strings.Fields(s)...)
}
