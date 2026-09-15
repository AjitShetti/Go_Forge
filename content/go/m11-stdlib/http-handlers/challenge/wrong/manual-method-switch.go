package main

import (
	"io"
	"net/http"
	"strings"
	"sync"
)

// One subtree pattern and a method switch, the pre-1.22 style. Unknown
// methods fall through to a 404, with no 405 and no Allow header.
func NewServer() http.Handler {
	var (
		mu    sync.Mutex
		store = map[string]string{}
	)
	mux := http.NewServeMux()
	mux.HandleFunc("/keys/", func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimPrefix(r.URL.Path, "/keys/")
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			v, ok := store[key]
			mu.Unlock()
			if !ok {
				http.Error(w, "not found", http.StatusNotFound)
				return
			}
			io.WriteString(w, v)
		case http.MethodPut:
			body, _ := io.ReadAll(r.Body)
			mu.Lock()
			store[key] = string(body)
			mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		case http.MethodDelete:
			mu.Lock()
			delete(store, key)
			mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "not found", http.StatusNotFound)
		}
	})
	return withRequestID(mux)
}

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
