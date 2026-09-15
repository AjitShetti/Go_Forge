package main

// Treats "the map has entries" as "the port key is set".
func Port(cfg map[string]int) int {
	if len(cfg) > 0 {
		return cfg["port"]
	}
	return 8080
}
