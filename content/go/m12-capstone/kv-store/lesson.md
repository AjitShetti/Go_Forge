---
{
  "slug": "kv-store",
  "title": "KV store with TTL, HTTP API, worker pool, graceful shutdown",
  "concepts": ["capstone"],
  "requires": ["raceDetector", "netListen"],
  "trap": {
    "concept": "capstone",
    "question": "The store's sweeper deletes expired entries every 100ms. A session with a 20ms TTL is read at 50ms, then again after the next sweep. What's printed?",
    "kind": "choice",
    "choices": [
      " false\n false",
      "ana true\n false",
      "ana false\n false",
      "ana true\nana true"
    ],
    "answer": 1
  },
  "rebuild": {
    "goal": "Make it print `processed: 5`. main (lines 10–17) is locked.",
    "lockedLines": [10, 11, 12, 13, 14, 15, 16, 17]
  },
  "challenge": {
    "prompt": "Build the capstone: a `Store` with per-key expiry and an injected clock, its HTTP `Handler`, and a bounded `Pool` with context-aware `Submit` and a `Shutdown` that drains the queue.",
    "entry": "starter.go"
  }
}
---

## Provoke

Every piece of the course in one small service. The store keeps entries with an expiry time behind a mutex (M8), and a background goroutine (M7) sweeps expired entries every 100ms. A session is stored with a 20ms TTL and read twice: at 50ms, and again after the first sweep.

## Decode

### Where correctness lives: on the read path

`Get` returned `ana true` 30ms after the session expired, because nothing on the read path checked the expiry. The sweeper was the only code that knew about time, and it hadn't run yet. With a 100ms sweep interval, a logged-out session keeps working for up to 100ms. Scale that up and you have a revoked API token that works for another minute.

The rule for any expiring data: **a read must decide whether the entry is still valid.** The sweeper is a memory-management detail. It keeps expired entries from piling up, but it never decides what `Get` returns. The Challenge's tests read at the exact expiry instant, before any sweep, to check that.

### Make time a dependency

The trap needed real sleeps, which makes it slow and would make tests flaky. The Challenge's `Store` takes `now func() time.Time` instead. Production passes `time.Now`, and tests pass a fake clock they move by hand: "advance 29 seconds, still there; advance 1 more, gone". That's M11's lesson about time being hard, applied: don't test timing by waiting.

### Graceful shutdown, from the pool up

Shutting down cleanly is three promises, in order:

1. **Stop accepting new work.** `Submit` after `Shutdown` returns `ErrClosed`, instead of panicking on a closed channel.
2. **Finish work already accepted.** Closing the jobs channel lets each worker's `range` drain the queue before it ends (M7). Workers that check a "quit" signal before each job drop it instead.
3. **Wait, but not forever.** `Shutdown(ctx)` waits for the workers, and returns `ctx.Err()` if a job is stuck (M8's context).

The Rebuild is promise 3 missing: `Shutdown` closes the queue and returns while the workers are still busy, so `main` exits and every job is lost (M7: the program ends when `main` returns).

`http.Server` implements the same three promises for connections. `Shutdown` closes the listener, waits for in-flight requests to finish, and gives up when its context ends:

```go verified id=server-shutdown mode=local reason=listens-on-a-port
package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

func main() {
	store := map[string]string{}
	mux := http.NewServeMux()
	mux.HandleFunc("PUT /kv/{key}", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		store[r.PathValue("key")] = string(body)
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond) // a request still in flight at shutdown
		io.WriteString(w, "finished anyway")
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0") // any free port
	if err != nil {
		panic(err)
	}
	srv := &http.Server{Handler: mux}
	served := make(chan error, 1)
	go func() { served <- srv.Serve(ln) }()
	base := "http://" + ln.Addr().String()

	req, _ := http.NewRequest("PUT", base+"/kv/lang", strings.NewReader("go"))
	res, err := http.DefaultClient.Do(req)
	fmt.Println("PUT:", res.StatusCode, err)

	slow := make(chan string, 1)
	go func() {
		res, err := http.Get(base + "/slow")
		if err != nil {
			slow <- "error: " + err.Error()
			return
		}
		body, _ := io.ReadAll(res.Body)
		slow <- string(body)
	}()
	time.Sleep(50 * time.Millisecond) // the slow request has started

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	fmt.Println("Shutdown:", srv.Shutdown(ctx)) // stops listening, waits for in-flight requests
	fmt.Println("Serve returned:", <-served)
	fmt.Println("slow request:", <-slow)

	_, err = http.Get(base + "/slow")
	fmt.Println("after shutdown, new request fails:", err != nil)
}
```

In a real `main`, the trigger is a signal: `ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)`, then `<-ctx.Done()`, then `srv.Shutdown` with a fresh timeout context, then the pool's `Shutdown`. The order matters: stop taking requests first, and only then stop the workers those requests feed.

(This demo's `store` map is written only by the one PUT request, so it doesn't need a lock. Your Challenge store is shared by concurrent requests, so it does.)

### How the capstone is graded, honestly

- **Correctness and graceful shutdown**: the Challenge's hidden tests cover expiry, the HTTP API, the pool's concurrency limit, draining, `ErrClosed`, and both context timeouts. They run in your browser and must pass.
- **Race-free under `-race`**: **not verified.** The browser engine has no race detector, and this course's content couldn't be checked with one. Run it yourself: add a test that hammers `Store` and `Pool` from many goroutines, then:

```shell
go test -race -count=20 ./...
```

- **A written explanation of one design tradeoff**: the Stretch. It's saved to your notebook and **not graded** by anything automatic.

**Engine note:** listening on a port needs a native machine, so the server block above was recorded from real Go by the content pipeline. The trap, the Rebuild and the Challenge run in your browser.

## Python/JS contrast

- **Python**: Redis-style expiry is the same lazy-plus-active design (`GET` checks, a background task samples). `concurrent.futures.ThreadPoolExecutor.shutdown(wait=True, cancel_futures=False)` is exactly this Pool's `Shutdown`, including the choice to drain rather than drop. `uvicorn` handles SIGTERM with a graceful timeout, like `http.Server.Shutdown`.
- **JavaScript**: Node's `server.close()` stops accepting connections and waits for existing ones, but keep-alive connections can hold it open, which is why libraries add a timeout. That's the job of Go's `Shutdown(ctx)`.
- **False friend:** "the TTL handles expiry". A TTL is data. Only code on the read path makes it mean anything.

## Rebuild

A pool of two workers gets five jobs. `Shutdown` closes the queue, and `main` prints how many jobs ran. `main` is locked.

## Challenge

One file, three parts. The hidden tests move a fake clock to check expiry to the second, drive the HTTP API with `httptest` (including a bad `ttl`), and exercise the pool: at most N jobs at once, every queued job runs before `Shutdown` returns, `ErrClosed` afterwards, `Submit` gives up on a full queue when its context ends, and `Shutdown` gives up on a stuck job.

## Stretch

Write the `main` that runs your store for real: `signal.NotifyContext`, `http.Server` on `:8080`, a sweeper goroutine on a `time.Ticker` that stops on shutdown, and a pool that writes an audit log. Run it, `curl` it, press Ctrl+C mid-request, and run `go test -race`. Then write, in a paragraph, **one tradeoff** you made and what you gave up. For example: RWMutex versus Mutex for this read-heavy store, dropping versus draining the queue on shutdown, or lazy expiry plus sweeping versus a timer per key. Save it with the stretch box below.
