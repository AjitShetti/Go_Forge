package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestOrderJSON(t *testing.T) {
	t.Run("marshal", func(t *testing.T) {
		b, err := json.Marshal(Order{ID: "o-1", TotalCents: 1999, Status: Paid, Note: "gift"})
		want := `{"id":"o-1","total_cents":1999,"status":"paid","note":"gift"}`
		if err != nil || string(b) != want {
			t.Fatalf("Marshal = %s, %v\nwant      %s", b, err, want)
		}
	})
	t.Run("empty note is omitted", func(t *testing.T) {
		b, err := json.Marshal(Order{ID: "o-2", TotalCents: 5, Status: Pending})
		want := `{"id":"o-2","total_cents":5,"status":"pending"}`
		if err != nil || string(b) != want {
			t.Fatalf("Marshal = %s, %v\nwant      %s", b, err, want)
		}
	})
	t.Run("decode", func(t *testing.T) {
		o, err := DecodeOrder([]byte(`{"id":"o-3","total_cents":250,"status":"shipped"}`))
		if err != nil || o != (Order{ID: "o-3", TotalCents: 250, Status: Shipped}) {
			t.Fatalf("DecodeOrder = %+v, %v", o, err)
		}
	})
	t.Run("round trip", func(t *testing.T) {
		for _, in := range []Order{{"a", 1, Pending, ""}, {"b", 2, Paid, "x"}, {"c", 3, Shipped, "y z"}} {
			b, err := json.Marshal(in)
			if err != nil {
				t.Fatalf("Marshal(%+v): %v", in, err)
			}
			out, err := DecodeOrder(b)
			if err != nil || out != in {
				t.Errorf("round trip %+v -> %s -> %+v, %v", in, b, out, err)
			}
		}
	})
	t.Run("unknown status is an error", func(t *testing.T) {
		_, err := DecodeOrder([]byte(`{"id":"o-4","total_cents":1,"status":"refunded"}`))
		if err == nil || !strings.Contains(err.Error(), "refunded") {
			t.Fatalf("DecodeOrder with status refunded: err = %v, want an error naming it", err)
		}
	})
	t.Run("unknown field is an error", func(t *testing.T) {
		_, err := DecodeOrder([]byte(`{"id":"o-5","totl_cents":100,"status":"paid"}`))
		if err == nil {
			t.Fatal("DecodeOrder accepted a misspelled field totl_cents")
		}
	})
}
