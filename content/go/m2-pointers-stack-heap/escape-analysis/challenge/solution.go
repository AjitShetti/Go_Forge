package main

// Fields appends the space-separated words of s to dst and returns the
// extended slice. Runs of spaces count as one separator; leading and trailing
// spaces are ignored. When dst has enough spare capacity, Fields must not
// allocate at all.
func Fields(dst []string, s string) []string {
	start := -1
	for i := 0; i < len(s); i++ {
		if s[i] == ' ' {
			if start >= 0 {
				// s[start:i] shares s's bytes: no new string is allocated.
				dst = append(dst, s[start:i])
				start = -1
			}
		} else if start < 0 {
			start = i
		}
	}
	if start >= 0 {
		dst = append(dst, s[start:])
	}
	return dst
}
