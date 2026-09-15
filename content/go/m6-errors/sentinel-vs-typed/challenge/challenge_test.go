package main

import "testing"

func TestParsePort(t *testing.T) {
	t.Run("valid ports", func(t *testing.T) {
		for _, c := range []struct {
			in   string
			want int
		}{{"80", 80}, {"1", 1}, {"65535", 65535}} {
			got, err := ParsePort(c.in)
			if err != nil || got != c.want {
				t.Errorf("ParsePort(%q) = %d, %v; want %d, nil", c.in, got, err, c.want)
			}
		}
	})
	t.Run("empty is the ErrEmpty sentinel", func(t *testing.T) {
		_, err := ParsePort("")
		if err != ErrEmpty {
			t.Fatalf("ParsePort(\"\") error = %#v, want ErrEmpty itself", err)
		}
	})
	t.Run("out of range is a *RangeError", func(t *testing.T) {
		for _, c := range []struct {
			in   string
			want int
		}{{"0", 0}, {"70000", 70000}, {"-1", -1}} {
			_, err := ParsePort(c.in)
			re, ok := err.(*RangeError)
			if !ok {
				t.Errorf("ParsePort(%q) error = %#v (%T), want *RangeError", c.in, err, err)
				continue
			}
			if re.Value != c.want {
				t.Errorf("ParsePort(%q): RangeError.Value = %d, want %d", c.in, re.Value, c.want)
			}
		}
	})
	t.Run("not a number is a *SyntaxError", func(t *testing.T) {
		for _, in := range []string{"http", "80 ", "8o8o"} {
			_, err := ParsePort(in)
			se, ok := err.(*SyntaxError)
			if !ok {
				t.Errorf("ParsePort(%q) error = %#v (%T), want *SyntaxError", in, err, err)
				continue
			}
			if se.Input != in {
				t.Errorf("ParsePort(%q): SyntaxError.Input = %q", in, se.Input)
			}
		}
	})
	t.Run("messages", func(t *testing.T) {
		_, err := ParsePort("99999")
		if err == nil || err.Error() != "port 99999 out of range 1-65535" {
			t.Errorf("ParsePort(\"99999\") message = %v", err)
		}
		_, err = ParsePort("abc")
		if err == nil || err.Error() != `port "abc" is not a number` {
			t.Errorf("ParsePort(\"abc\") message = %v", err)
		}
	})
}
