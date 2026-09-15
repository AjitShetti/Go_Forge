package main

import "fmt"

// Fixes label but not i: every handler reports the final index.
func Handlers(labels []string) []func() string {
	var hs []func() string
	for i, label := range labels {
		label := label
		hs = append(hs, func() string {
			return fmt.Sprintf("%d:%s", i, label)
		})
	}
	return hs
}
