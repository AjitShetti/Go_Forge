package main

// Handles a nil map, but a missing key still reads as 0.
func Port(cfg map[string]int) int {
	if cfg == nil {
		return 8080
	}
	return cfg["port"]
}
