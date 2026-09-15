package main

import (
	"io"
	"net/http"
	"sync"
)

func NewServer() http.Handler {
	var (
		mu    sync.Mutex
		store = map[string]string{}
	)
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
		body, _ := io.ReadAll(r.Body)
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

// Sets the header after the handler has run. By then the status line and
// headers have already been written, so the header never reaches the client.
func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = "none"
		}
		w.Header().Set("X-Request-ID", id)
	})
}
