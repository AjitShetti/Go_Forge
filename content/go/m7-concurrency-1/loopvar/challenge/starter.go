package main

import "fmt"

// Handlers builds one click handler per button label. This module's go.mod
// says go 1.21.
//
// Handler i must return fmt.Sprintf("%d:%s", i, label) with the label that
// labels[i] held when Handlers was called, no matter when the handler runs,
// even if the caller changes labels afterwards.
func Handlers(labels []string) []func() string {
	var hs []func() string
	for i, label := range labels {
		hs = append(hs, func() string {
			return fmt.Sprintf("%d:%s", i, label)
		})
	}
	return hs
}
