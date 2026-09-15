# Grading (P6)

**Grade** on the canvas runs a deterministic rule engine against the selected scenario. The same design and scenario always produce the same report, and every finding prints the numbers that triggered it. There is no LLM and no randomness. The engine is `src/lib/grader/grade.ts`, a pure function that runs the same in the browser and on the server.

## Using it

- Open `/scenarios` → **Event ticketing: flash sale**. You can start from scratch, from a naive design (score 35) or from a passing reference (score 100).
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
- **Capacity** = `replicas × QPS in`. A kind with no replica setting counts as 1 replica.
- **Kinds with no replica setting** (CDN, Object Store) are treated as managed multi-zone services, not single points of failure.
- **Request path.** A node is on the request path when it is reachable from a Client or Cron over request edges.
- **Cycles** are disclosed. Load is not pushed around a cycle.

## Rules

A scenario enables rules and may override a rule's severity (`src/lib/grader/scenarios.ts`).

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

## Ticketing flash sale

- **Scale:** 200,000 rps peak and a read:write ratio of 20:1.
- **Thresholds:** the p99 budget is 800 ms, and a design counts as read-heavy from 10:1.
- **Constraints:** five, with the rules that check each one listed on `/scenarios/ticketing-flash-sale`.
- **Overrides:** this scenario raises `client-direct-data` to a violation.
- **Reference designs** (`src/lib/grader/examples.ts`):
  - The naive design (client → one app → one DB) scores **35**. It has 4 violations (two SPOFs, capacity, no admission queue) and 1 warning.
  - The reference design scores **100**. It still reports 4 tradeoffs: CDN hit rate, app cache hit rate, queue backlog and replica staleness.

## Storage

- **Scenarios table.** Migration `20260915000500_scenarios.sql` seeds `scenarios`.
  - The migration is generated: run `node scripts/gen-scenarios-sql.mjs`.
  - A unit test fails if it drifts from the TypeScript.
  - It was applied to the live project.
- **`design_reviews` rows:**
  - `violations` holds the violation findings.
  - `warnings` holds the warnings plus the tradeoffs; each finding carries its `severity`.

## Verification

```
npx tsc --noEmit && npm test        # 193 tests, 19 of them grader tests
npx next build --webpack            # in a git worktree whose node_modules is a junction; plain `npm run build` works in the main checkout
npm run verify:p6                   # 27 checks, headless Edge, signed out + signed in (live Supabase). Cleans up after itself; no reset needed
npm run verify:p5                   # 65 checks, still passing (its P6 badge assertion now expects the badge to be gone)
```

Screenshots: `docs/evidence/screens/p6-*.png`.

## Known limits

- **One QPS number per node.** A node's QPS out applies to every outgoing connection. An app that reads its cache on every request and its DB only on misses can't give those two edges different rates. The `load-shedding` tradeoff names the assumption instead.
- **Dead-letter queues are recognised by label** (`dead letter` / `DLQ`). Nodes have no DLQ field.
- **Anyone can insert their own review rows.** RLS allows an owner to insert a `design_reviews` row with any score directly through the API. The app only writes server-computed grades. Locking this down needs grading in the database or a service-role writer, which is out of scope for a single-user app.
- **Tradeoffs can't be declared yet.** The report lists undeclared tradeoffs, but there is no field for declaring them, so they never go away. They cost no points.
- **Optional LLM critique** is out of scope until P8.
