package main

// Unformatted is a tiny `gofmt -l`. It returns, sorted by name, every file
// whose content isn't exactly what gofmt would produce, byte for byte, final
// newline included. A file that doesn't parse is reported as
// "<name> (syntax error)" instead of its plain name.
func Unformatted(files map[string]string) []string {
	return nil
}
