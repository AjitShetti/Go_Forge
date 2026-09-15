package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
)

func main() {
	notFound := func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "no such item")
		w.WriteHeader(http.StatusNotFound)
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/items/42", nil)
	http.HandlerFunc(notFound).ServeHTTP(rec, req)
	fmt.Println(rec.Code, strings.TrimSpace(rec.Body.String()))
}
