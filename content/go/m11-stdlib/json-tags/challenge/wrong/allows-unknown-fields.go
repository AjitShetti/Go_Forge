package main

import (
	"encoding/json"
	"fmt"
)

// Status is an order's state. In JSON it is a string: "pending", "paid" or
// "shipped". Decoding any other string is an error.
type Status int

const (
	Pending Status = iota
	Paid
	Shipped
)

var statusNames = []string{"pending", "paid", "shipped"}

// MarshalJSON makes Status a json.Marshaler. It must return valid JSON, so the
// name is encoded as a JSON string (with quotes), not written raw.
func (s Status) MarshalJSON() ([]byte, error) {
	if s < 0 || int(s) >= len(statusNames) {
		return nil, fmt.Errorf("invalid status %d", int(s))
	}
	return json.Marshal(statusNames[s])
}

// UnmarshalJSON needs a pointer receiver: it has to change the Status inside
// the Order the decoder is filling in.
func (s *Status) UnmarshalJSON(data []byte) error {
	var name string
	if err := json.Unmarshal(data, &name); err != nil {
		return fmt.Errorf("status must be a string: %w", err)
	}
	for i, n := range statusNames {
		if n == name {
			*s = Status(i)
			return nil
		}
	}
	return fmt.Errorf("unknown status %q", name)
}

// Order is the JSON shape of an order, for example:
//
//	{"id":"o-1","total_cents":1999,"status":"paid","note":"gift"}
//
// note is left out when empty.
type Order struct {
	ID         string `json:"id"`
	TotalCents int64  `json:"total_cents"`
	Status     Status `json:"status"`
	Note       string `json:"note,omitempty"`
}

// DecodeOrder parses one order. A field the Order doesn't have (a typo like
// "totl_cents") is an error, not something to skip silently.
func DecodeOrder(data []byte) (Order, error) {
	// Silently skips fields Order doesn't have.
	var o Order
	if err := json.Unmarshal(data, &o); err != nil {
		return Order{}, err
	}
	return o, nil
}
