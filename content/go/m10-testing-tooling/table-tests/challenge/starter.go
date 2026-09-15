package main

// Explain compares got with want for a table-driven test and returns "" when
// they match, or a failure message that points at the problem.
//
//   - A nil slice and an empty slice match.
//   - Different lengths: "got 1 elements, want 2: [\"a\"] vs [\"a\" \"b\"]"
//     (use %d for the lengths and %q for both slices).
//   - Same length: describe the FIRST differing element:
//     "element 1: got \"b \", want \"b\"" (use %q for both elements).
func Explain(got, want []string) string {
	return ""
}
