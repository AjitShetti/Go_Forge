package main

import "net/http"

// NewServer returns an HTTP handler for a small in-memory key-value API:
//
//	GET    /keys/{key}  200 with the value as the body, or 404 with body "not found\n"
//	PUT    /keys/{key}  stores the request body as the value, 204
//	DELETE /keys/{key}  removes the key (missing is fine), 204
//
// Any other method on /keys/{key} gets 405 with an Allow header.
//
// Every response, including errors and 405s, carries an X-Request-ID header:
// the request's own X-Request-ID if it sent one, otherwise "none".
func NewServer() http.Handler {
	return http.NewServeMux()
}
