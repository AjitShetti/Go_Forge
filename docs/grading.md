# Grading (P6, scenarios extended in P7)

**Grade** on the canvas runs a deterministic rule engine against the selected scenario. The same design and scenario always produce the same report, and every finding prints the numbers that triggered it. There is no LLM and no randomness. The engine is `src/lib/grader/grade.ts`, a pure function that runs the same in the browser and on the server.

## Using it

- Open `/scenarios` and pick one of the six scenarios. You can start from scratch, from a naive design that fails, or from a passing reference that scores 100.
- The **Scenario** picker in the canvas toolbar is saved with each version (`designs.scenario_id`). Changing it counts as an unsaved change.
- **Grade** opens the report. While the report is open it re-grades on every edit.
- **Recorded vs. not recorded.**
  - A grade is written to `design_reviews` only when the canvas is exactly a saved version.
  - The server action `recordReview` reloads that version from the database and grades it there, so a stored score always matches a stored graph.
  - When the design is unsaved, signed out, or edited after grading, the report says **Not recorded** and why.
- **Show on canvas** selects the nodes and edges a finding names and zooms to them.

## Score

`100 − 15 × violations − 5 × warnings`, floored at 0. Tradeoffs cost nothing. **Passed = zero violations.** A design with no client (nothing to grade) scores 0. The report prints this arithmetic.

## Load model

The spec's config fields (P5, `catalog.ts`) are all the grader has, so it fixes one reading of them. Every report lists the assumptions it applied to that graph.

- **Direction.** Edges point caller → callee. `sync`, `async` and `cache_read` carry request load. `replication` and `batch` do not.
- **Entry load.** The scenario's peak QPS leaves the Client nodes, split evenly over every client connection. The clients' own QPS out is ignored.
- **Pass-through nodes.** Load balancers and API gateways forward everything they receive, split evenly over their outgoing connections.
- **Rate limiters and CDNs** send `min(QPS out, load in)` down each connection.
- **Every other node** sends its QPS out down **each** outgoing request connection.
- **Dead-letter queues.** Connections into a queue labelled "dead letter" or "DLQ" carry no load, because failed messages are assumed rare. The report lists this assumption when it applies.
- **Capacity** = `replicas × QPS in`. A kind with no replica setting counts as 1 replica.
- **Kinds with no replica setting** (CDN, Object Store) are treated as managed multi-zone services, not single points of failure.
- **Request path.** A node is on the request path when it is reachable from a Client or Cron over request edges.
- **Cycles** are disclosed. Load is not pushed around a cycle.

## Rules

A scenario enables rules and may override a rule's severity (`src/lib/grader/scenarios.ts`). It can also give a `why` sentence per rule, which is appended to that rule's findings (ticketing: "Two buyers can both see and take the last seat."), so the rule text itself stays scenario-neutral.

| Rule | Default | Fires when |
|---|---|---|
| `has-entry` | violation | there is no Client, or no Client has a request connection |
| `client-direct-data` | warning | a Client connects straight to a SQL DB, NoSQL store, Cache or Search Index |
| `spof` | violation | a node on the request path has replicas < 2, unless it is a SQL primary with a replication edge to a replica |
| `capacity` | violation | load arriving at a node > replicas × QPS in; the report shows each incoming stream, the capacity product and the shortfall |
| `read-heavy-cache` | warning | the scenario's read:write ratio ≥ its threshold and no Cache or CDN is on the request path |
| `queue-dlq` | warning | a queue, and the consumers it feeds, have no connection to a queue labelled "dead letter" or "DLQ" |
| `strong-inventory` | violation | no SQL primary or strongly consistent NoSQL store with persistence is on the request path |
| `admission-queue` | violation | some client path reaches that store without passing a Message Queue; the path is named, and a rate limiter doesn't count |
| `latency-budget` | violation | the p99 sum along the slowest path a caller waits on (sync + cache_read) exceeds the budget; async edges end the wait |
| `unreachable` | warning | components are not reachable from a Client or Cron |
| `load-shedding` | tradeoff | a node sends less than it receives: the rate limiter's rejected share, the CDN hit rate, or an app's cache hit rate is assumed |
| `queue-backlog` | tradeoff | a queue takes in more than it drains; shows growth per second and after 60 s |
| `replica-reads` | tradeoff | a read replica serves waiting callers, so reads are stale |
| `cross-region-sync` | tradeoff | a waiting call crosses regions; the inter-region round trip is not in the p99 sum |
| `async-fanout` | violation | no Pub/Sub topic or Message Queue on the request path is fed by an async connection, or a Worker is on a path the caller waits on (path named) |
| `rate-limit-entry` | violation | a client path reaches an App Service, Worker or data store without passing a Rate Limiter; the search stops at the first such node |
| `limiter-shared-state` | violation | a Rate Limiter with ≥ 2 replicas has no connection to a Cache or NoSQL store; shows replicas × per-key limit |
| `blob-through-app` | warning | a waited-on client path to an Object Store passes an App Service, API Gateway or Worker; shows uploads/s and the bandwidth (× average file size) |
| `cdn-for-blobs` | violation | an Object Store is on the request path and no CDN connects to one; shows downloads/s |
| `storage-capacity` | violation | persistent storage of the node kinds the scenario names (not replicas) is below what it needs; shows each node, the total and the shortfall |
| `presence-store` | violation | no store labelled "presence" is on the request path, or one is persistent; shows the heartbeat load it takes |
| `durable-store` | violation | no SQL primary or NoSQL store with persistence on is on the request path |

## Scenarios

Each has 5 constraints, and every enabled rule is cited by one of them (a unit test enforces this). The starting designs are in `src/lib/grader/examples.ts`.

| Scenario | Peak | Read : write | p99 budget | Overrides and parameters | Naive design | Reference tradeoffs |
|---|---|---|---|---|---|---|
| `ticketing-flash-sale` | 200,000 rps | 20 : 1 | 800 ms | `client-direct-data` → violation | 35: 2 SPOFs, capacity, admission-queue; 1 warning | CDN hit rate, cache hit rate, queue backlog, replica staleness |
| `url-shortener` | 40,400 rps | 100 : 1 | 100 ms | `client-direct-data` → violation | 50: 2 SPOFs, capacity; read-heavy warning | cache hit rate |
| `news-feed-fanout` | 150,000 rps | 29 : 1 | 300 ms | `client-direct-data` → violation | 35: 2 SPOFs, capacity, async-fanout; read-heavy warning | cache hit rate, fan-out backlog |
| `rate-limited-public-api` | 120,000 rps | 4 : 1 | 150 ms | `client-direct-data` → violation; 100 rps per key | 55: limiter-shared-state, capacity, DB SPOF | rejected share (83.3%) |
| `file-storage-cdn` | 50,000 rps | 49 : 1 | 400 ms | `client-direct-data` and `blob-through-app` → violation; 5 MB files; 11,000,000 GB of Object Store | 20: blob-through-app, cdn-for-blobs, storage-capacity, capacity, DB SPOF; read-heavy warning | CDN hit rate, cache hit rate |
| `chat-presence` | 800,000 rps | 1 : 1 | 200 ms | `client-direct-data` → violation | 25: 2 SPOFs, capacity, async-fanout, presence-store | message service load not passed on |

In P7 the ticketing scenario's fair-queue constraint also cites `client-direct-data`. That rule was already enabled, but no constraint listed it, so the scenario page never showed it.

## Storage

- **Scenarios table.** `20260915000500_scenarios.sql` (P6) seeded ticketing. `20260915000600_scenarios_p7.sql` upserts all six.
  - The newest migration is generated: run `node scripts/gen-scenarios-sql.mjs`, and add a new migration file name there when scenarios change after it has been applied.
  - A unit test fails if it drifts from the TypeScript, and `verify:scenarios` compares the live rows.
  - Both were applied to the live project.
- **`design_reviews` rows:**
  - `violations` holds the violation findings.
  - `warnings` holds the warnings plus the tradeoffs; each finding carries its `severity`.

## Verification

```
npx tsc --noEmit && npm test        # 329 tests after the P6+P7 merge, 42 of them grader tests
npx next build --webpack            # in a git worktree whose node_modules is a junction; plain `npm run build` works in the main checkout
npm run verify:p6                   # 27 checks, headless Edge, signed out + signed in (live Supabase). Cleans up after itself; no reset needed
npm run verify:p5                   # 65 checks, still passing (its P6 badge assertion now expects the badge to be gone)
npm run verify:scenarios            # P7: 43 checks. All six scenarios signed out (pages, both starting designs, a live regrade), live rows vs. TypeScript, one recorded grade. Cleans up after itself
```

Screenshots: `docs/evidence/screens/p6-*.png` and `p7-scenario-*.png`, `p7-report-*-naive.png`.

## Known limits

- **One QPS number per node.** A node's QPS out applies to every outgoing connection. An app that reads its cache on every request and its DB only on misses can't give those two edges different rates. The `load-shedding` tradeoff names the assumption instead.
- **Dead-letter queues and presence stores are recognised by label** (`dead letter` / `DLQ`, `presence`). Nodes have no field for either.
- **Entry load splits evenly over client connections.** In file storage, the upload, download and API connections each get a third of the peak, although downloads dominate in reality. The report states this as an assumption.
- **Anyone can insert their own review rows.** RLS allows an owner to insert a `design_reviews` row with any score directly through the API. The app only writes server-computed grades. Locking this down needs grading in the database or a service-role writer, which is out of scope for a single-user app.
- **Tradeoffs can't be declared yet.** The report lists undeclared tradeoffs, but there is no field for declaring them, so they never go away. They cost no points.
- **Optional LLM critique** is out of scope until P8.
