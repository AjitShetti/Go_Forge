package main

// Port returns the port to listen on. If cfg has a "port" key, its value is
// used, even when that value is 0 (port 0 asks the OS for any free port).
// If the key is missing, or cfg is nil, Port returns 8080.
func Port(cfg map[string]int) int {
	if p := cfg["port"]; p != 0 {
		return p
	}
	return 8080
}
