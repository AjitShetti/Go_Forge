package main

import (
	"math/rand/v2"
	"strings"
	"testing"
	"unicode/utf8"
)

var sink string

func TestReverse(t *testing.T) {
	t.Run("examples", func(t *testing.T) {
		for in, want := range map[string]string{
			"":        "",
			"a":       "a",
			"gopher":  "rehpog",
			"héllo":   "olléh",
			"日本語":     "語本日",
			"🙂 ok":    "ko 🙂",
			"hé":      "éh",
			"ünïcode": "edocïnü",
		} {
			if got := Reverse(in); got != want {
				t.Errorf("Reverse(%q) = %q, want %q", in, got, want)
			}
		}
	})

	// The kind of inputs a fuzzer finds first: short, and mixing one-byte and
	// multi-byte characters.
	t.Run("regressions", func(t *testing.T) {
		for _, in := range []string{"aé", "éa", "a€b", "ÿĀ", "x🙂"} {
			got := Reverse(in)
			if !utf8.ValidString(got) {
				t.Errorf("Reverse(%q) = %q is not valid UTF-8", in, got)
			}
			if back := Reverse(got); back != in {
				t.Errorf("Reverse(Reverse(%q)) = %q", in, back)
			}
		}
	})

	// A property checked over many generated inputs, like a fuzz target would,
	// but with a fixed seed so every run tries the same strings.
	t.Run("property over generated strings", func(t *testing.T) {
		alphabet := []rune("aZ9 _é€日🙂́")
		rng := rand.New(rand.NewPCG(1, 2))
		for n := 0; n < 2000; n++ {
			var b strings.Builder
			for k := rng.IntN(12); k > 0; k-- {
				b.WriteRune(alphabet[rng.IntN(len(alphabet))])
			}
			in := b.String()
			got := Reverse(in)
			if !utf8.ValidString(got) || Reverse(got) != in || utf8.RuneCountInString(got) != utf8.RuneCountInString(in) {
				t.Fatalf("property fails for %q: Reverse = %q", in, got)
			}
		}
	})

	t.Run("at most one allocation", func(t *testing.T) {
		// Longer than 32 runes: a shorter []rune conversion can use a small
		// stack buffer and hide an allocation.
		for _, in := range []string{strings.Repeat("hello, fuzzing world ", 3), strings.Repeat("héllo wörld, 日本語 ", 3)} {
			allocs := testing.AllocsPerRun(100, func() { sink = Reverse(in) })
			if allocs > 1 {
				t.Errorf("Reverse(%q) allocates %v times per call, want at most 1", in, allocs)
			}
		}
	})
}
