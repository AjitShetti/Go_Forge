package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
)

func main() {
	for _, path := range []string{"/items/7", "/items/x"} {
		rec := httptest.NewRecorder()
		newMux().ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		fmt.Printf("%d %q\n", rec.Code, rec.Body.String())
	}
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			http.Error(w, "bad id", http.StatusBadRequest)
		}
		fmt.Fprintf(w, "item %d\n", id)
	})
	return mux
}
