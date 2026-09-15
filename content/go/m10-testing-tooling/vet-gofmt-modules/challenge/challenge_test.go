package main

import (
	"slices"
	"testing"
)

const clean = "package p\n\nfunc f(a, b int) int {\n\treturn a*b + 1\n}\n"

func TestUnformatted(t *testing.T) {
	cases := []struct {
		name  string
		files map[string]string
		want  []string
	}{
		{"nothing to check", map[string]string{}, nil},
		{"already formatted", map[string]string{"ok.go": clean}, nil},
		{"spacing", map[string]string{"a.go": "package p\n\nfunc f(a, b int) int {\n\treturn a * b + 1\n}\n"}, []string{"a.go"}},
		{"indented with spaces", map[string]string{"b.go": "package p\n\nfunc f(a, b int) int {\n    return a*b + 1\n}\n"}, []string{"b.go"}},
		{"missing final newline", map[string]string{"c.go": "package p\n\nfunc f(a, b int) int {\n\treturn a*b + 1\n}"}, []string{"c.go"}},
		{"extra blank lines at the end", map[string]string{"d.go": clean + "\n\n"}, []string{"d.go"}},
		{"does not parse", map[string]string{"e.go": "package p\nfunc f() {"}, []string{"e.go (syntax error)"}},
		{"unused import is still formatted", map[string]string{"f.go": "package p\n\nimport \"os\"\n"}, nil},
		{
			"sorted report",
			map[string]string{
				"zeta.go": "package p\nvar z=1\n", "alpha.go": "package p\nvar a=1\n", "mid.go": clean,
				"beta.go": "package p\nfunc (", "gamma.go": "package p\nvar g=1\n", "delta.go": "package p\nvar d=1\n",
			},
			[]string{"alpha.go", "beta.go (syntax error)", "delta.go", "gamma.go", "zeta.go"},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Unformatted(c.files); !slices.Equal(got, c.want) {
				t.Errorf("Unformatted = %q, want %q", got, c.want)
			}
		})
	}
}
