---
{
  "slug": "http-handlers",
  "title": "Handlers, muxes, and what ServeHTTP really is",
  "concepts": ["net-http"],
  "requires": [],
  "trap": {
    "concept": "net-http",
    "question": "The handler writes a body, then sets status 404. httptest.NewRecorder captures the response. What code and body come back?",
    "kind": "choice",
    "choices": [
      "404 no such item",
      "200 no such item",
      "404",
      "500 no such item"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `200 \"item 7\\n\"` and then `400 \"bad id\\n\"`. main (lines 10–16) is locked.",
    "lockedLines": [10, 11, 12, 13, 14, 15, 16]
  },
  "challenge": {
    "prompt": "Build `NewServer()`: GET/PUT/DELETE on `/keys/{key}`, 405 with Allow for other methods, and an `X-Request-ID` header on every response, set by middleware.",
    "entry": "starter.go"
  }
}
---

## Provoke

A handler writes its body first, then remembers to set the status to 404. `httptest.NewRecorder` is a fake `ResponseWriter`: no network, just a record of what the handler did.

## Decode

### A response is written in order, once

`http.ResponseWriter` is a stream, not a struct you fill in and return. An HTTP/1.1 response goes out as **status line, headers, body**, in that order. So:

- The first call to `Write` checks whether a status was set. It wasn't, so `Write` calls `WriteHeader(200)` itself, which sends the status and the headers.
- A later `WriteHeader(404)` is too late: the status is already on the wire. A real server logs `http: superfluous response.WriteHeader call` and ignores it, and the recorder ignores it too.
- `w.Header().Set(...)` after the first `Write` or `WriteHeader` changes a map nobody will read again.

So the rule: **headers, then status, then body.** And `http.Error(w, msg, code)` is just those three calls. It doesn't stop your handler, which is the Rebuild.

### Everything is a Handler

The whole server model is one interface:

```
type Handler interface {
	ServeHTTP(ResponseWriter, *Request)
}
```

- `http.HandlerFunc(f)` is a function type with a `ServeHTTP` method that calls `f`. That's how a plain function becomes a Handler.
- `*http.ServeMux` is a Handler that looks at the request and calls another Handler.
- **Middleware** is a function `func(http.Handler) http.Handler` that returns a Handler doing something before and/or after calling `next.ServeHTTP`. Logging, auth, request IDs and recovery from panics all work this way.
- `http.Server` accepts connections, parses each request, and calls **one** Handler per request, **in its own goroutine**. Handlers run concurrently, so any shared state needs a lock.

Because a Handler never touches the network directly, `httptest.NewRecorder` plus `ServeHTTP` tests a whole router in memory, and that's how every program in this lesson runs in your browser.

### Patterns since Go 1.22

`ServeMux` patterns can include a **method** and **wildcards**: `"GET /items/{id}"`, read with `r.PathValue("id")`. A pattern ending in `/` matches a whole subtree. When several patterns match, the **most specific** one wins, and conflicting patterns panic at registration. If a path matches but no pattern has that method, the mux answers `405` with an `Allow` header, unless a broader pattern like `"/"` (which matches every method) catches it first:

```go verified id=mux-patterns
package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
)

func serve(h http.Handler, method, path string) {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	fmt.Printf("%s %s -> %d %q Allow=%q\n", method, path, rec.Code, rec.Body.String(), rec.Header().Get("Allow"))
}

func main() {
	api := http.NewServeMux()
	api.HandleFunc("GET /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "item "+r.PathValue("id"))
	})
	api.HandleFunc("GET /items/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "items subtree")
	})
	serve(api, "GET", "/items/7")
	serve(api, "GET", "/items/7/reviews")
	serve(api, "POST", "/items/7")

	api.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "catch-all")
	})
	serve(api, "POST", "/items/7")
}
```

**Engine note:** the browser engine can't open a listening socket, so `http.ListenAndServe` doesn't work there. Handlers, muxes, middleware and `httptest` do, because none of them need the network. Run a real server locally to try `curl` against it.

## Python/JS contrast

- **Python**: WSGI is the same idea as `Handler`: a callable taking the request environ and a `start_response` function. And WSGI has the same ordering rule, since `start_response` (status and headers) must be called before the body is returned. Flask hides it by making the view *return* `(body, status, headers)`, which is why "set the status after writing" isn't even expressible there.
- **JavaScript**: Node's `res.write()` then `res.statusCode = 404` has the same problem, and Node throws `ERR_HTTP_HEADERS_SENT` when you set headers too late. Express middleware `(req, res, next)` is the same shape as Go's `func(http.Handler) http.Handler`.
- **False friend:** `http.Error(w, "bad id", 400)` looks like `raise HTTPException(400)` or `return res.status(400)`. It writes a response and then your handler keeps running.

## Rebuild

`/items/x` is rejected with `http.Error`, and then the handler carries on and appends `item 0`. `main` is locked.

## Challenge

`NewServer` is a small key-value HTTP API. The hidden tests drive it with `httptest`: a missing key, a PUT then GET, DELETE (including a key that was never there), two servers that must not share data, a POST that must be a 405 with `Allow`, and `X-Request-ID` on successes, errors and 405s alike.

## Stretch

Run `NewServer` locally behind `http.ListenAndServe(":8080", ...)` and `curl -i` it. Then add a middleware that recovers from panics and returns 500, and check with a handler that panics. In which order must the request-ID and recovery middlewares wrap each other so that a 500 still carries the request ID?
