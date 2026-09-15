package main

import "testing"

func TestTruncate(t *testing.T) {
	cases := []struct {
		name string
		s    string
		n    int
		want string
	}{
		{"ascii short", "hello", 10, "hello"},
		{"ascii exact", "hello", 5, "hello"},
		{"ascii cut", "hello", 3, "hel…"},
		{"accent exact", "héllo", 5, "héllo"},
		{"accent cut after", "héllo", 2, "hé…"},
		{"accent cut before", "héllo", 1, "h…"},
		{"japanese", "日本語のテキスト", 3, "日本語…"},
		{"emoji", "🙂🙃🙂", 1, "🙂…"},
		{"empty", "", 0, ""},
		{"zero", "abc", 0, "…"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Truncate(c.s, c.n); got != c.want {
				t.Errorf("Truncate(%q, %d) = %q, want %q", c.s, c.n, got, c.want)
			}
		})
	}
}
