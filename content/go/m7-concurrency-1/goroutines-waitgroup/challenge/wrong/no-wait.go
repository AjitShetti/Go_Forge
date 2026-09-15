package main

// Starts every call concurrently, then adds up before any of them finished.
func TotalSize(paths []string, size func(path string) int) int {
	sizes := make([]int, len(paths))
	for i, p := range paths {
		go func() {
			sizes[i] = size(p)
		}()
	}
	total := 0
	for _, s := range sizes {
		total += s
	}
	return total
}
