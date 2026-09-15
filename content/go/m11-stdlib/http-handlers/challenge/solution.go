package main

import (
	"io"
	"net/http"
	"sync"
)

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
	var (
		mu    sync.Mutex // handlers run concurrently in a real server
		store = map[string]string{}
	)

	// Method patterns (Go 1.22+): the mux answers 405 and sets Allow for
	// methods that have no pattern.
	mux := http.NewServeMux()
	mux.HandleFunc("GET /keys/{key}", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		v, ok := store[r.PathValue("key")]
		mu.Unlock()
		if !ok {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		io.WriteString(w, v)
	})
	mux.HandleFunc("PUT /keys/{key}", func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "cannot read body", http.StatusBadRequest)
			return
		}
		mu.Lock()
		store[r.PathValue("key")] = string(body)
		mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("DELETE /keys/{key}", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		delete(store, r.PathValue("key"))
		mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	})
	return withRequestID(mux)
}

// withRequestID is middleware: a Handler that wraps a Handler. Headers must be
// set BEFORE calling next, because the first Write or WriteHeader sends them.
func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = "none"
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r)
	})
}
