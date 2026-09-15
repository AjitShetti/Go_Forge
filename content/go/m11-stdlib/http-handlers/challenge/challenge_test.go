package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type response struct {
	code  int
	body  string
	allow string
	reqID string
}

func do(h http.Handler, method, path, body, reqID string) response {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if reqID != "" {
		req.Header.Set("X-Request-ID", reqID)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	res := rec.Result()
	return response{rec.Code, rec.Body.String(), res.Header.Get("Allow"), res.Header.Get("X-Request-ID")}
}

func TestServer(t *testing.T) {
	t.Run("missing key is 404", func(t *testing.T) {
		r := do(NewServer(), "GET", "/keys/nope", "", "")
		if r.code != 404 || r.body != "not found\n" {
			t.Fatalf("GET missing: %d %q, want 404 \"not found\\n\"", r.code, r.body)
		}
	})
	t.Run("put then get", func(t *testing.T) {
		s := NewServer()
		if r := do(s, "PUT", "/keys/lang", "go", ""); r.code != 204 {
			t.Fatalf("PUT: %d, want 204", r.code)
		}
		if r := do(s, "GET", "/keys/lang", "", ""); r.code != 200 || r.body != "go" {
			t.Fatalf("GET after PUT: %d %q, want 200 \"go\"", r.code, r.body)
		}
	})
	t.Run("delete", func(t *testing.T) {
		s := NewServer()
		do(s, "PUT", "/keys/k", "v", "")
		if r := do(s, "DELETE", "/keys/k", "", ""); r.code != 204 {
			t.Fatalf("DELETE: %d, want 204", r.code)
		}
		if r := do(s, "GET", "/keys/k", "", ""); r.code != 404 {
			t.Fatalf("GET after DELETE: %d, want 404", r.code)
		}
		if r := do(s, "DELETE", "/keys/never-there", "", ""); r.code != 204 {
			t.Fatalf("DELETE missing: %d, want 204", r.code)
		}
	})
	t.Run("servers don't share data", func(t *testing.T) {
		do(NewServer(), "PUT", "/keys/shared", "x", "")
		if r := do(NewServer(), "GET", "/keys/shared", "", ""); r.code != 404 {
			t.Fatalf("a new server sees another server's key: %d %q", r.code, r.body)
		}
	})
	t.Run("wrong method is 405 with Allow", func(t *testing.T) {
		r := do(NewServer(), "POST", "/keys/k", "v", "")
		if r.code != 405 || !strings.Contains(r.allow, "GET") || !strings.Contains(r.allow, "PUT") {
			t.Fatalf("POST: %d Allow=%q, want 405 with GET and PUT allowed", r.code, r.allow)
		}
	})
	t.Run("request ID echoed on success", func(t *testing.T) {
		s := NewServer()
		do(s, "PUT", "/keys/a", "1", "")
		if r := do(s, "GET", "/keys/a", "", "req-77"); r.reqID != "req-77" {
			t.Fatalf("X-Request-ID = %q, want req-77", r.reqID)
		}
	})
	t.Run("request ID on errors, default none", func(t *testing.T) {
		s := NewServer()
		if r := do(s, "GET", "/keys/zzz", "", ""); r.reqID != "none" {
			t.Fatalf("404 X-Request-ID = %q, want none", r.reqID)
		}
		if r := do(s, "PATCH", "/keys/zzz", "", "req-9"); r.reqID != "req-9" {
			t.Fatalf("405 X-Request-ID = %q, want req-9", r.reqID)
		}
	})
}
