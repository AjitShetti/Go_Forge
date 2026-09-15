// The deterministic grader. Same graph + same scenario = same report, and
// every finding carries the numbers that triggered it. No randomness, no
// clock, no network: it runs identically in the browser and on the server.
//
// Model (also in docs/grading.md):
//   - Edge direction is caller → callee. sync, async and cache_read carry
//     request load; replication and batch do not.
//   - The scenario's peak QPS leaves the clients, split evenly over every
//     client connection.
//   - Load balancers and API gateways pass everything they receive through,
//     split evenly over their outgoing connections. Their qpsOut is ignored.
//   - Rate limiters and CDNs send min(qpsOut, load in) down each connection.
//   - Every other node sends its qpsOut down EACH outgoing connection.
//   - Capacity = replicas × qpsIn (replicas = 1 when the kind has none).
import { NODE_SPECS, type NodeKind } from "@/lib/canvas/catalog";
import type { DesignEdge, DesignGraph, DesignNode } from "@/lib/canvas/graph";
import type { Finding, GradeReport, RuleId, Scenario, Severity } from "./types";

export const POINTS: Record<Severity, number> = { violation: 15, warning: 5, tradeoff: 0 };

const DEFAULT_SEVERITY: Record<RuleId, Severity> = {
  "has-entry": "violation",
  "client-direct-data": "warning",
  spof: "violation",
  capacity: "violation",
  "read-heavy-cache": "warning",
  "queue-dlq": "warning",
  "strong-inventory": "violation",
  "admission-queue": "violation",
  "latency-budget": "violation",
  "load-shedding": "tradeoff",
  "cross-region-sync": "tradeoff",
  "replica-reads": "tradeoff",
  "queue-backlog": "tradeoff",
  unreachable: "warning",
};

const REQUEST = new Set(["sync", "async", "cache_read"]);
const WAITS = new Set(["sync", "cache_read"]);
const PASS_THROUGH = new Set<NodeKind>(["load_balancer", "api_gateway"]);
const CAPPED = new Set<NodeKind>(["rate_limiter", "cdn"]);
const DIRECT_DATA = new Set<NodeKind>(["sql_db", "nosql", "cache", "search_index"]);
const ENTRY = new Set<NodeKind>(["client", "cron"]);
const DLQ_LABEL = /dead[\s_-]*letter|\bdlq\b/i;
const EPS = 1e-6;

export const fmt = (n: number) => (Number.isInteger(n) || Math.abs(n) >= 100 ? Math.round(n).toLocaleString("en-US") : (Math.round(n * 10) / 10).toLocaleString("en-US"));

type Ctx = {
  g: DesignGraph;
  s: Scenario;
  byId: Map<string, DesignNode>;
  out: Map<string, DesignEdge[]>;
  inc: Map<string, DesignEdge[]>;
  /** Reachable from a client or cron over request edges. */
  onPath: Set<string>;
  load: Map<string, number>;
  edgeLoad: Map<string, number>;
  cycle: string[];
  label: (id: string) => string;
};

type Draft = Omit<Finding, "severity" | "rule">;
type Rule = (c: Ctx) => Draft[];

export function grade(graph: DesignGraph, scenario: Scenario): GradeReport {
  const c = context(graph, scenario);
  const assumptions: string[] = [];
  const findings: Finding[] = [];

  for (const { rule, severity } of scenario.rules) {
    const sev = severity ?? DEFAULT_SEVERITY[rule];
    for (const d of RULES[rule](c)) findings.push({ rule, severity: sev, ...d });
    if (rule === "has-entry" && findings.some((f) => f.rule === "has-entry" && f.severity === "violation")) break;
  }

  const clientEdges = graph.edges.filter((e) => REQUEST.has(e.kind) && c.byId.get(e.source)?.kind === "client");
  if (clientEdges.length) assumptions.push(`The scenario's peak of ${fmt(scenario.scale.peakQps)} rps leaves the clients split evenly over ${clientEdges.length} client connection${clientEdges.length === 1 ? "" : "s"}: ${fmt(scenario.scale.peakQps / clientEdges.length)} rps each.`);
  const passNodes = graph.nodes.filter((n) => PASS_THROUGH.has(n.kind) && c.onPath.has(n.id));
  if (passNodes.length) assumptions.push(`${list(passNodes.map((n) => n.config.label))} forward${passNodes.length === 1 ? "s" : ""} all incoming load, split evenly over outgoing connections; their QPS out is not used.`);
  const others = graph.nodes.filter((n) => !PASS_THROUGH.has(n.kind) && !ENTRY.has(n.kind) && c.onPath.has(n.id) && (c.out.get(n.id) ?? []).some((e) => REQUEST.has(e.kind)));
  if (others.length) assumptions.push(`${list(others.map((n) => n.config.label))}: QPS out is sent down each outgoing request connection${others.some((n) => CAPPED.has(n.kind)) ? " (rate limiters and CDNs never send more than they receive)" : ""}.`);
  const managed = graph.nodes.filter((n) => c.onPath.has(n.id) && n.config.replicas === undefined && !ENTRY.has(n.kind));
  if (managed.length) assumptions.push(`${list(managed.map((n) => n.config.label))} ha${managed.length === 1 ? "s" : "ve"} no replica setting and ${managed.length === 1 ? "is" : "are"} treated as a managed multi-zone service: not a single point of failure.`);
  if (c.cycle.length) assumptions.push(`Load is not propagated around the cycle through ${list(c.cycle.map(c.label))}; those nodes only count load from outside the cycle.`);

  const violations = findings.filter((f) => f.severity === "violation");
  const warnings = findings.filter((f) => f.severity === "warning");
  const tradeoffs = findings.filter((f) => f.severity === "tradeoff");
  const scoreMath = [{ label: "Start", points: 100 }];
  if (violations.length) scoreMath.push({ label: `${violations.length} violation${violations.length === 1 ? "" : "s"} × −${POINTS.violation}`, points: -POINTS.violation * violations.length });
  if (warnings.length) scoreMath.push({ label: `${warnings.length} warning${warnings.length === 1 ? "" : "s"} × −${POINTS.warning}`, points: -POINTS.warning * warnings.length });
  let raw = scoreMath.reduce((a, l) => a + l.points, 0);
  if (findings.some((f) => f.rule === "has-entry" && f.severity === "violation") && raw > 0) {
    scoreMath.push({ label: "No request path to grade: score is 0", points: -raw });
    raw = 0;
  }
  if (raw < 0) scoreMath.push({ label: "Floor at 0", points: -raw });

  return {
    scenario: scenario.slug,
    score: Math.max(0, raw),
    passed: violations.length === 0,
    scoreMath,
    violations,
    warnings,
    tradeoffs,
    assumptions,
    load: Object.fromEntries([...c.load].filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v * 10) / 10])),
  };
}

// --------------------------------------------------------------- context ---

function context(g: DesignGraph, s: Scenario): Ctx {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const out = new Map<string, DesignEdge[]>();
  const inc = new Map<string, DesignEdge[]>();
  for (const n of g.nodes) {
    out.set(n.id, []);
    inc.set(n.id, []);
  }
  for (const e of g.edges) {
    out.get(e.source)?.push(e);
    inc.get(e.target)?.push(e);
  }
  const label = (id: string) => byId.get(id)?.config.label ?? id;

  const onPath = reach(g.nodes.filter((n) => ENTRY.has(n.kind)).map((n) => n.id), out, (e) => REQUEST.has(e.kind));

  // Kahn's algorithm over request edges, so load flows in dependency order.
  const load = new Map<string, number>(g.nodes.map((n) => [n.id, 0]));
  const edgeLoad = new Map<string, number>();
  const indeg = new Map<string, number>(g.nodes.map((n) => [n.id, 0]));
  for (const e of g.edges) if (REQUEST.has(e.kind)) indeg.set(e.target, indeg.get(e.target)! + 1);
  const queue = g.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const done = new Set<string>();
  const clientEdgeCount = g.edges.filter((e) => REQUEST.has(e.kind) && byId.get(e.source)?.kind === "client").length;
  const settle = (id: string) => {
    const n = byId.get(id)!;
    const outs = out.get(id)!.filter((e) => REQUEST.has(e.kind));
    const inLoad = load.get(id)!;
    for (const e of outs) {
      let v: number;
      if (!onPath.has(id)) v = 0;
      else if (n.kind === "client") v = s.scale.peakQps / clientEdgeCount;
      else if (PASS_THROUGH.has(n.kind)) v = inLoad / outs.length;
      else if (CAPPED.has(n.kind)) v = Math.min(n.config.qpsOut ?? 0, inLoad);
      else v = n.config.qpsOut ?? 0;
      edgeLoad.set(e.id, v);
      load.set(e.target, load.get(e.target)! + v);
    }
  };
  while (queue.length) {
    const id = queue.shift()!;
    done.add(id);
    settle(id);
    for (const e of out.get(id)!) {
      if (!REQUEST.has(e.kind)) continue;
      indeg.set(e.target, indeg.get(e.target)! - 1);
      if (indeg.get(e.target) === 0) queue.push(e.target);
    }
  }
  // Nodes on a cycle: settle them once with whatever load reached them from outside.
  const cycle = g.nodes.filter((n) => !done.has(n.id)).map((n) => n.id);
  for (const id of cycle) settle(id);

  return { g, s, byId, out, inc, onPath, load, edgeLoad, cycle, label };
}

function reach(start: string[], out: Map<string, DesignEdge[]>, follow: (e: DesignEdge) => boolean): Set<string> {
  const seen = new Set(start);
  const stack = [...start];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of out.get(id) ?? []) {
      if (follow(e) && !seen.has(e.target)) {
        seen.add(e.target);
        stack.push(e.target);
      }
    }
  }
  return seen;
}

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const replicas = (n: DesignNode) => n.config.replicas ?? 1;
const isStrongStore = (n: DesignNode) => (n.kind === "sql_db" && n.config.role !== "replica") || (n.kind === "nosql" && n.config.consistency === "strong");

// ----------------------------------------------------------------- rules ---

const RULES: Record<RuleId, Rule> = {
  "has-entry": (c) => {
    const clients = c.g.nodes.filter((n) => n.kind === "client");
    if (clients.length === 0) return [{ title: "No client", detail: "The design has 0 Client nodes, so no request path exists to grade. Add a Client and connect it.", nodeIds: [], edgeIds: [] }];
    const connected = clients.filter((n) => c.out.get(n.id)!.some((e) => REQUEST.has(e.kind)));
    if (connected.length === 0) return [{ title: "Client sends nothing", detail: `${list(clients.map((n) => n.config.label))} ha${clients.length === 1 ? "s" : "ve"} 0 outgoing sync, async or cache-read connections, so no request path exists to grade.`, nodeIds: clients.map((n) => n.id), edgeIds: [] }];
    return [];
  },

  "client-direct-data": (c) =>
    c.g.edges
      .filter((e) => REQUEST.has(e.kind) && c.byId.get(e.source)!.kind === "client" && DIRECT_DATA.has(c.byId.get(e.target)!.kind))
      .map((e) => ({
        title: "Client talks to a data store directly",
        detail: `${c.label(e.source)} → ${c.label(e.target)} (${NODE_SPECS[c.byId.get(e.target)!.kind].title}) has no service in between: no auth, no validation, no place to shed load, and the store's schema becomes your public API.`,
        nodeIds: [e.source, e.target],
        edgeIds: [e.id],
      })),

  spof: (c) =>
    c.g.nodes
      .filter((n) => c.onPath.has(n.id) && n.config.replicas !== undefined && replicas(n) < 2)
      .filter((n) => !(n.kind === "sql_db" && n.config.role !== "replica" && c.out.get(n.id)!.some((e) => e.kind === "replication" && c.byId.get(e.target)!.kind === "sql_db" && c.byId.get(e.target)!.config.role === "replica")))
      .map((n) => {
        const stateful = NODE_SPECS[n.kind].stateful;
        const extra = n.kind === "sql_db" && n.config.role !== "replica" ? " and no replication connection to a replica" : "";
        return {
          title: stateful ? "Single point of failure (holds data)" : "Single point of failure",
          detail: `${n.config.label} is on the request path with replicas = ${replicas(n)}${extra}. The scenario requires surviving the loss of any one node; losing this one ${stateful ? `loses ${n.config.persistence === false ? "its data and " : ""}every request that needs it` : "stops every request that passes through it"}.`,
          math: [`replicas = ${replicas(n)} < 2`],
          nodeIds: [n.id],
          edgeIds: [],
        };
      }),

  capacity: (c) =>
    c.g.nodes
      .filter((n) => c.onPath.has(n.id) && n.config.qpsIn !== undefined && c.load.get(n.id)! > replicas(n) * n.config.qpsIn + EPS)
      .map((n) => {
        const cap = replicas(n) * n.config.qpsIn!;
        const arriving = c.load.get(n.id)!;
        const ins = c.inc.get(n.id)!.filter((e) => (c.edgeLoad.get(e.id) ?? 0) > 0);
        return {
          title: "Over capacity",
          detail: `${n.config.label} receives ${fmt(arriving)} rps but can accept ${fmt(cap)} rps.`,
          math: [
            ...ins.map((e) => `${c.label(e.source)} → ${n.config.label}: ${fmt(c.edgeLoad.get(e.id)!)} rps`),
            `arriving = ${fmt(arriving)} rps`,
            `capacity = ${replicas(n)} replica${replicas(n) === 1 ? "" : "s"} × ${fmt(n.config.qpsIn!)} rps = ${fmt(cap)} rps`,
            `short by ${fmt(arriving - cap)} rps (${fmt(arriving / cap)}× capacity)`,
          ],
          nodeIds: [n.id],
          edgeIds: ins.map((e) => e.id),
        };
      }),

  "read-heavy-cache": (c) => {
    const { readWriteRatio } = c.s.scale;
    const { readHeavyRatio } = c.s.params;
    if (readWriteRatio < readHeavyRatio) return [];
    const caches = c.g.nodes.filter((n) => c.onPath.has(n.id) && (n.kind === "cache" || n.kind === "cdn"));
    if (caches.length) return [];
    return [
      {
        title: "Read-heavy with no cache",
        detail: `The scenario reads ${readWriteRatio}× more than it writes, but no Cache or CDN is on the request path, so every read lands on a store.`,
        math: [`read : write = ${readWriteRatio} : 1 ≥ ${readHeavyRatio} : 1 threshold`, "Cache or CDN nodes on the request path = 0"],
        nodeIds: [],
        edgeIds: [],
      },
    ];
  },

  "queue-dlq": (c) =>
    c.g.nodes
      .filter((n) => n.kind === "queue" && !DLQ_LABEL.test(n.config.label))
      .filter((q) => {
        const consumers = c.out.get(q.id)!.filter((e) => REQUEST.has(e.kind)).map((e) => e.target);
        return ![q.id, ...consumers].some((id) => c.out.get(id)!.some((e) => e.target !== q.id && c.byId.get(e.target)!.kind === "queue" && DLQ_LABEL.test(c.byId.get(e.target)!.config.label)));
      })
      .map((q) => ({
        title: "Queue has no dead-letter path",
        detail: `${q.config.label} has no connection (from itself or from its consumers) to a queue labelled "dead letter" or "DLQ". A message that fails every retry either blocks the line or disappears.`,
        math: [`queues labelled /dead letter|dlq/ reachable from ${q.config.label} or its consumers = 0`],
        nodeIds: [q.id],
        edgeIds: [],
      })),

  "strong-inventory": (c) => {
    const stores = c.g.nodes.filter((n) => c.onPath.has(n.id) && (n.kind === "sql_db" || n.kind === "nosql") && n.config.role !== "replica");
    if (stores.some((n) => isStrongStore(n) && n.config.persistence !== false)) return [];
    return [
      {
        title: "No strongly consistent store for inventory",
        detail: stores.length
          ? `None of the stores on the request path is both strongly consistent and persistent, so two buyers can both see and take the last seat.`
          : "No SQL DB (primary) or NoSQL store is on the request path, so seat inventory has nowhere safe to live.",
        math: stores.length ? stores.map((n) => `${n.config.label}: consistency = ${n.kind === "sql_db" ? "strong (SQL primary)" : n.config.consistency}, persistent = ${n.config.persistence}`) : ["SQL primaries + NoSQL stores on the request path = 0"],
        nodeIds: stores.map((n) => n.id),
        edgeIds: [],
      },
    ];
  },

  "admission-queue": (c) => {
    const targets = c.g.nodes.filter((n) => c.onPath.has(n.id) && isStrongStore(n) && n.config.persistence !== false);
    const clients = c.g.nodes.filter((n) => n.kind === "client").map((n) => n.id);
    const found: Draft[] = [];
    for (const t of targets) {
      // BFS from the clients through everything except queues; a hit is a path that skips the line.
      const parent = new Map<string, DesignEdge | null>(clients.map((id) => [id, null]));
      const q = [...clients];
      while (q.length && !parent.has(t.id)) {
        const id = q.shift()!;
        for (const e of c.out.get(id)!) {
          if (!REQUEST.has(e.kind) || parent.has(e.target)) continue;
          if (c.byId.get(e.target)!.kind === "queue") continue;
          parent.set(e.target, e);
          q.push(e.target);
        }
      }
      if (!parent.has(t.id)) continue;
      const edges: DesignEdge[] = [];
      for (let e = parent.get(t.id); e; e = parent.get(e.source)) edges.unshift(e);
      const path = [edges[0].source, ...edges.map((e) => e.target)];
      const limiter = path.find((id) => c.byId.get(id)!.kind === "rate_limiter");
      found.push({
        title: "The spike reaches inventory without a queue",
        detail: `${path.map(c.label).join(" → ")} reaches ${t.config.label} with no Message Queue in between, so arrival order is decided by whichever request wins the race.${limiter ? ` ${c.label(limiter)} drops excess requests; it does not put buyers in line.` : ""}`,
        math: [`path: ${path.map(c.label).join(" → ")}`, "Message Queue nodes on this path = 0"],
        nodeIds: path,
        edgeIds: edges.map((e) => e.id),
      });
    }
    return found;
  },

  "latency-budget": (c) => {
    // Longest p99 sum over edges the caller waits on, starting at clients.
    const clients = c.g.nodes.filter((n) => n.kind === "client").map((n) => n.id);
    const waitReach = reach(clients, c.out, (e) => WAITS.has(e.kind));
    const indeg = new Map<string, number>([...waitReach].map((id) => [id, 0]));
    for (const e of c.g.edges) if (WAITS.has(e.kind) && waitReach.has(e.source)) indeg.set(e.target, indeg.get(e.target)! + 1);
    const best = new Map<string, { ms: number; path: string[]; edges: string[] }>();
    const q = clients.filter((id) => indeg.get(id) === 0);
    for (const id of q) best.set(id, { ms: c.byId.get(id)!.config.p99Ms ?? 0, path: [id], edges: [] });
    while (q.length) {
      const id = q.shift()!;
      const cur = best.get(id)!;
      for (const e of c.out.get(id)!) {
        if (!WAITS.has(e.kind)) continue;
        const ms = cur.ms + (c.byId.get(e.target)!.config.p99Ms ?? 0);
        const prev = best.get(e.target);
        if (!prev || ms > prev.ms) best.set(e.target, { ms, path: [...cur.path, e.target], edges: [...cur.edges, e.id] });
        indeg.set(e.target, indeg.get(e.target)! - 1);
        if (indeg.get(e.target) === 0) q.push(e.target);
      }
    }
    let worst: { ms: number; path: string[]; edges: string[] } | null = null;
    for (const v of best.values()) if (!worst || v.ms > worst.ms) worst = v;
    const budget = c.s.params.p99BudgetMs;
    if (!worst || worst.ms <= budget + EPS) return [];
    return [
      {
        title: "Synchronous path over the latency budget",
        detail: `The slowest path a caller waits on adds up to ${fmt(worst.ms)} ms at p99; the budget is ${fmt(budget)} ms. Anything that can finish later belongs behind an async connection.`,
        math: [worst.path.map((id) => `${c.label(id)} ${fmt(c.byId.get(id)!.config.p99Ms ?? 0)}`).join(" + ") + ` = ${fmt(worst.ms)} ms`, `${fmt(worst.ms)} ms > ${fmt(budget)} ms budget`],
        nodeIds: worst.path,
        edgeIds: worst.edges,
      },
    ];
  },

  "load-shedding": (c) =>
    c.g.nodes
      .filter((n) => c.onPath.has(n.id) && (CAPPED.has(n.kind) || n.kind === "app_service" || n.kind === "worker") && c.out.get(n.id)!.some((e) => REQUEST.has(e.kind)))
      .flatMap((n): Draft[] => {
        const inLoad = c.load.get(n.id)!;
        const outPer = n.config.qpsOut ?? 0;
        if (inLoad <= outPer + EPS) return [];
        if (n.kind === "rate_limiter")
          return [{ title: "Rate limiter rejects traffic", detail: `${n.config.label} admits ${fmt(outPer)} of ${fmt(inLoad)} rps per connection; ${fmt(inLoad - outPer)} rps (${fmt((100 * (inLoad - outPer)) / inLoad)}%) get rejected. Say what those buyers see.`, math: [`${fmt(inLoad)} − ${fmt(outPer)} = ${fmt(inLoad - outPer)} rps rejected`], nodeIds: [n.id], edgeIds: [] }];
        if (n.kind === "cdn")
          return [{ title: "CDN hit rate assumed", detail: `${n.config.label} sends ${fmt(outPer)} of ${fmt(inLoad)} rps to origin, which assumes ${fmt((100 * (inLoad - outPer)) / inLoad)}% of requests are cache hits. Seat availability changes every second; say which responses are cacheable.`, math: [`hit rate = (${fmt(inLoad)} − ${fmt(outPer)}) / ${fmt(inLoad)} = ${fmt((100 * (inLoad - outPer)) / inLoad)}%`], nodeIds: [n.id], edgeIds: [] }];
        const cached = c.out.get(n.id)!.some((e) => e.kind === "cache_read");
        return [
          {
            title: cached ? "Cache hit rate assumed" : "Load disappears",
            detail: cached
              ? `${n.config.label} receives ${fmt(inLoad)} rps and sends ${fmt(outPer)} rps down each connection, which assumes its cache answers the rest. A cold or failed cache sends up to ${fmt(inLoad)} rps downstream.`
              : `${n.config.label} receives ${fmt(inLoad)} rps but sends only ${fmt(outPer)} rps down each connection, with no cache read-through. The other ${fmt(inLoad - outPer)} rps are assumed to need no downstream call.`,
            math: [`${fmt(inLoad)} rps in − ${fmt(outPer)} rps out = ${fmt(inLoad - outPer)} rps unaccounted`],
            nodeIds: [n.id],
            edgeIds: [],
          },
        ];
      }),

  "cross-region-sync": (c) =>
    c.g.edges
      .filter((e) => WAITS.has(e.kind))
      .flatMap((e): Draft[] => {
        const a = c.byId.get(e.source)!.config.region;
        const b = c.byId.get(e.target)!.config.region;
        if (!a || !b || a === "global" || b === "global" || a === b) return [];
        return [{ title: "Synchronous call across regions", detail: `${c.label(e.source)} (${a}) waits on ${c.label(e.target)} (${b}). The latency budget sums node p99s only; the round trip between regions comes on top and the call fails if the link does.`, math: [`${a} ≠ ${b}`], nodeIds: [e.source, e.target], edgeIds: [e.id] }];
      }),

  "replica-reads": (c) =>
    c.g.nodes
      .filter((n) => c.onPath.has(n.id) && n.kind === "sql_db" && n.config.role === "replica" && c.inc.get(n.id)!.some((e) => WAITS.has(e.kind)))
      .map((n) => ({
        title: "Reads from a replica are stale",
        detail: `${n.config.label} is a read replica serving ${fmt(c.load.get(n.id)!)} rps. It lags the primary, so a seat can show as free after it sold. The final check before a sale has to read the primary.`,
        nodeIds: [n.id],
        edgeIds: c.inc.get(n.id)!.filter((e) => WAITS.has(e.kind)).map((e) => e.id),
      })),

  "queue-backlog": (c) =>
    c.g.nodes
      .filter((n) => n.kind === "queue" && c.onPath.has(n.id))
      .flatMap((n): Draft[] => {
        const inLoad = c.load.get(n.id)!;
        const drain = n.config.qpsOut ?? 0;
        if (inLoad <= drain + EPS) return [];
        const grow = inLoad - drain;
        return [{ title: "Queue backlog grows during the spike", detail: `${n.config.label} takes in ${fmt(inLoad)} rps and drains ${fmt(drain)} rps, so the line grows by ${fmt(grow)} messages a second. That is the point of the queue; say how long buyers wait and when you stop accepting.`, math: [`${fmt(inLoad)} − ${fmt(drain)} = ${fmt(grow)} msg/s`, `after 60 s: ${fmt(grow * 60)} messages waiting`], nodeIds: [n.id], edgeIds: [] }];
      }),

  unreachable: (c) => {
    const extended = reach([...c.onPath], c.out, () => true);
    const lost = c.g.nodes.filter((n) => !extended.has(n.id));
    if (lost.length === 0) return [];
    return [{ title: "Components not connected to any request path", detail: `${list(lost.map((n) => n.config.label))} ${lost.length === 1 ? "is" : "are"} not reachable from a Client or Cron, so the grader ignores ${lost.length === 1 ? "it" : "them"}.`, math: [`unreachable components = ${lost.length}`], nodeIds: lost.map((n) => n.id), edgeIds: [] }];
  },
};
