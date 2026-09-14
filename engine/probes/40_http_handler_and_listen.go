package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
)

func main() {
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "hi from handler")
	})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	fmt.Println(rec.Code, rec.Body.String())
	// Invalid address: fails fast on every platform instead of serving forever.
	err := http.ListenAndServe("256.256.256.256:80", nil)
	fmt.Println("listen error:", err != nil)
}
