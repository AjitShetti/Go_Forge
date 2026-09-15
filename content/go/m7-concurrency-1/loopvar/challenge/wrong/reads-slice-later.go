package main

import "fmt"

// Copies i, then looks the label up when the handler runs, so it sees any
// change the caller made to labels in the meantime.
func Handlers(labels []string) []func() string {
	var hs []func() string
	for i := range labels {
		i := i
		hs = append(hs, func() string {
			return fmt.Sprintf("%d:%s", i, labels[i])
		})
	}
	return hs
}
