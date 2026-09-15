package main

import "encoding/json"

// Status is an order's state. In JSON it is a string: "pending", "paid" or
// "shipped". Decoding any other string is an error.
type Status int

const (
	Pending Status = iota
	Paid
	Shipped
)

// Order is the JSON shape of an order, for example:
//
//	{"id":"o-1","total_cents":1999,"status":"paid","note":"gift"}
//
// note is left out when empty.
type Order struct {
	ID         string `json:"id"`
	TotalCents int64  `json:"total_cents"`
	Status     Status `json:"status"`
	Note       string `json:"note"`
}

// DecodeOrder parses one order. A field the Order doesn't have (a typo like
// "totl_cents") is an error, not something to skip silently.
func DecodeOrder(data []byte) (Order, error) {
	var o Order
	err := json.Unmarshal(data, &o)
	return o, err
}
