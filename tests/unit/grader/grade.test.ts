import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type DesignGraph, parseGraph } from "@/lib/canvas/graph";
import { TICKETING_GOOD, TICKETING_NAIVE, build } from "@/lib/grader/examples";
import { grade } from "@/lib/grader/grade";
import { SCENARIOS, TICKETING_FLASH_SALE as S } from "@/lib/grader/scenarios";
import type { GradeReport, RuleId } from "@/lib/grader/types";

const all = (r: GradeReport) => [...r.violations, ...r.warnings, ...r.tradeoffs];
const rules = (r: GradeReport) => all(r).map((f) => f.rule);
const only = (r: GradeReport, rule: RuleId) => all(r).filter((f) => f.rule === rule);
const clone = (g: DesignGraph): DesignGraph => JSON.parse(JSON.stringify(g));
const setNode = (g: DesignGraph, id: string, patch: object) => {
  const n = g.nodes.find((x) => x.id === id)!;
  n.config = { ...n.config, ...patch };
  return g;
};

describe("reference designs", () => {
  it("both examples are valid stored graphs", () => {
    expect(parseGraph(TICKETING_GOOD).ok).toBe(true);
    expect(parseGraph(TICKETING_NAIVE).ok).toBe(true);
  });

  it("the good ticketing design passes with 100 and only declares tradeoffs", () => {
    const r = grade(TICKETING_GOOD, S);
    expect(r.violations).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
    expect(r.tradeoffs.map((f) => f.rule).sort()).toEqual(["load-shedding", "load-shedding", "queue-backlog", "replica-reads"]);
    expect(r.load).toMatchObject({ cdn: 100_000, lb: 100_000, gw: 100_000, app: 100_000, queue: 5000, worker: 1000, primary: 1000 });
  });

  it("the naive design fails with the score arithmetic shown", () => {
    const r = grade(TICKETING_NAIVE, S);
    expect(r.passed).toBe(false);
    expect(r.violations.map((f) => f.rule).sort()).toEqual(["admission-queue", "capacity", "spof", "spof"]);
    expect(r.warnings.map((f) => f.rule)).toEqual(["read-heavy-cache"]);
    expect(r.scoreMath).toEqual([
      { label: "Start", points: 100 },
      { label: "4 violations × −15", points: -60 },
      { label: "1 warning × −5", points: -5 },
    ]);
    expect(r.score).toBe(35);
  });

  it("is deterministic and independent of node and edge order", () => {
    const a = grade(TICKETING_NAIVE, S);
    const shuffled = clone(TICKETING_NAIVE);
    shuffled.nodes.reverse();
    shuffled.edges.reverse();
    const b = grade(shuffled, S);
    expect(JSON.stringify(grade(TICKETING_NAIVE, S))).toBe(JSON.stringify(a));
    expect(b.score).toBe(a.score);
    expect(rules(b).sort()).toEqual(rules(a).sort());
  });
});

describe("rules cite the numbers that triggered them", () => {
  it("capacity: shows arriving load, replicas × qpsIn, and the shortfall", () => {
    const [f] = only(grade(TICKETING_NAIVE, S), "capacity");
    expect(f.nodeIds).toEqual(["app"]);
    expect(f.math).toEqual(["Buyers → Ticket app: 200,000 rps", "arriving = 200,000 rps", "capacity = 1 replica × 2,000 rps = 2,000 rps", "short by 198,000 rps (100× capacity)"]);
  });

  it("capacity: entry load splits evenly over client connections; pass-through nodes forward all of it", () => {
    const g = clone(TICKETING_GOOD);
    setNode(g, "lb", { replicas: 1, qpsIn: 60_000 });
    const [f] = only(grade(g, S), "capacity");
    expect(f.nodeIds).toEqual(["lb"]);
    expect(f.math).toContain("capacity = 1 replica × 60,000 rps = 60,000 rps");
    expect(f.math).toContain("arriving = 100,000 rps");
  });

  it("spof: a primary with one replica setting passes only with a replication edge to a replica", () => {
    const g = clone(TICKETING_GOOD);
    g.edges = g.edges.filter((e) => e.kind !== "replication");
    const [f] = only(grade(g, S), "spof");
    expect(f.nodeIds).toEqual(["primary"]);
    expect(f.detail).toMatch(/replicas = 1 and no replication connection/);
  });

  it("spof: single-instance stateless node on the path is flagged too", () => {
    const g = setNode(clone(TICKETING_GOOD), "worker", { replicas: 1, qpsIn: 5000 });
    expect(only(grade(g, S), "spof").map((f) => f.nodeIds[0])).toEqual(["worker"]);
  });

  it("read-heavy-cache: fires at the scenario ratio, not below its threshold", () => {
    const r = grade(TICKETING_NAIVE, S);
    expect(only(r, "read-heavy-cache")[0].math).toEqual(["read : write = 20 : 1 ≥ 10 : 1 threshold", "Cache or CDN nodes on the request path = 0"]);
    const low = { ...S, scale: { ...S.scale, readWriteRatio: 2 } };
    expect(only(grade(TICKETING_NAIVE, low), "read-heavy-cache")).toEqual([]);
  });

  it("queue-dlq: a queue without a dead-letter connection is flagged", () => {
    const g = clone(TICKETING_GOOD);
    g.edges = g.edges.filter((e) => e.id !== "e11");
    const f = only(grade(g, S), "queue-dlq");
    // The dead-letter queue itself is now unreachable and not a queue needing its own DLQ.
    expect(f.map((x) => x.nodeIds[0])).toEqual(["queue"]);
    expect(only(grade(g, S), "unreachable")[0].detail).toMatch(/Purchase dead letter is not reachable/);
  });

  it("client-direct-data: client → DB is a violation in this scenario, a warning by default", () => {
    const g = build(
      [
        ["c", "client", 0, 0],
        ["db", "sql_db", 0, 0, { replicas: 3, qpsIn: 100_000 }],
      ],
      [["e", "c", "db", "sync"]],
    );
    expect(only(grade(g, S), "client-direct-data")[0]).toMatchObject({ severity: "violation", edgeIds: ["e"] });
    const lenient = { ...S, rules: S.rules.map((r) => (r.rule === "client-direct-data" ? { rule: r.rule } : r)) };
    expect(only(grade(g, lenient), "client-direct-data")[0].severity).toBe("warning");
  });

  it("strong-inventory: eventual NoSQL as the only store fails; making it strong passes", () => {
    const g = clone(TICKETING_GOOD);
    const p = g.nodes.find((n) => n.id === "primary")!;
    p.kind = "nosql";
    p.config = { label: "Seat inventory", replicas: 3, region: "us-east-1", qpsIn: 20_000, p99Ms: 5, storageGb: 10, consistency: "eventual", persistence: true };
    g.edges = g.edges.filter((e) => e.kind !== "replication");
    const [f] = only(grade(g, S), "strong-inventory");
    expect(f.math).toEqual(["Seat inventory: consistency = eventual, persistent = true"]);
    p.config.consistency = "strong";
    expect(only(grade(g, S), "strong-inventory")).toEqual([]);
  });

  it("admission-queue: a path to inventory that skips the queue is named; a rate limiter does not count", () => {
    const g = build(
      [
        ["c", "client", 0, 0, { label: "Buyers" }],
        ["rl", "rate_limiter", 0, 0, { label: "Limiter", qpsOut: 1000 }],
        ["app", "app_service", 0, 0, { label: "API", replicas: 200 }],
        ["db", "sql_db", 0, 0, { label: "Seats", replicas: 3 }],
      ],
      [
        ["e1", "c", "rl", "sync"],
        ["e2", "rl", "app", "sync"],
        ["e3", "app", "db", "sync"],
      ],
    );
    const [f] = only(grade(g, S), "admission-queue");
    expect(f.math).toEqual(["path: Buyers → Limiter → API → Seats", "Message Queue nodes on this path = 0"]);
    expect(f.detail).toMatch(/Limiter drops excess requests/);
    expect(f.edgeIds).toEqual(["e1", "e2", "e3"]);
    expect(only(grade(g, S), "load-shedding")[0].detail).toMatch(/admits 1,000 of 200,000 rps/);
  });

  it("latency-budget: sums p99 along the slowest path the caller waits on; async ends the wait", () => {
    const g = setNode(clone(TICKETING_GOOD), "app", { p99Ms: 790 });
    const [f] = only(grade(g, S), "latency-budget");
    expect(f.math).toEqual(["Buyers 0 + Load balancer 2 + API gateway 10 + Sale API 790 + Seats read replica 10 = 812 ms", "812 ms > 800 ms budget"]);
    // The worker is 200 ms but sits behind an async edge, so it is not on the waiting path.
    expect(f.nodeIds).not.toContain("worker");
  });

  it("cross-region-sync and queue-backlog show their arithmetic", () => {
    const g = setNode(clone(TICKETING_GOOD), "replica", { region: "eu-west-1" });
    expect(only(grade(g, S), "cross-region-sync")[0].math).toEqual(["us-east-1 ≠ eu-west-1"]);
    expect(only(grade(g, S), "queue-backlog")[0].math).toEqual(["5,000 − 1,000 = 4,000 msg/s", "after 60 s: 240,000 messages waiting"]);
  });
});

describe("edge cases", () => {
  it("an empty design scores 0 with the reason stated", () => {
    const r = grade(build([], []), S);
    expect(r.score).toBe(0);
    expect(r.violations.map((f) => f.rule)).toEqual(["has-entry"]);
    expect(r.scoreMath.at(-1)).toEqual({ label: "No request path to grade: score is 0", points: -85 });
  });

  it("a cycle does not hang and is disclosed as an assumption", () => {
    const g = build(
      [
        ["c", "client", 0, 0],
        ["a", "app_service", 0, 0, { label: "A" }],
        ["b", "app_service", 0, 0, { label: "B" }],
      ],
      [
        ["e1", "c", "a", "sync"],
        ["e2", "a", "b", "sync"],
        ["e3", "b", "a", "sync"],
      ],
    );
    const r = grade(g, S);
    expect(r.assumptions.some((a) => /cycle through A and B/.test(a))).toBe(true);
  });

  it("every rule a scenario constraint cites is enabled in that scenario", () => {
    for (const s of SCENARIOS) {
      const enabled = new Set(s.rules.map((r) => r.rule));
      for (const c of s.constraints) for (const r of c.rules) expect(enabled.has(r), `${s.slug}/${c.id}/${r}`).toBe(true);
    }
  });

  it("the scenarios migration seeds exactly the TypeScript scenarios", () => {
    const sql = readFileSync(resolve(import.meta.dirname, "..", "..", "..", "supabase", "migrations", "20260915000600_scenarios_p7.sql"), "utf8");
    const lit = "'((?:[^']|'')*)'";
    const un = (v: string) => v.replaceAll("''", "'");
    for (const s of SCENARIOS) {
      const m = sql.match(new RegExp(`'${s.slug}',\\s*${lit},\\s*${lit}::jsonb,\\s*${lit}::jsonb,\\s*${lit}::jsonb`));
      expect(m, s.slug).not.toBeNull();
      expect(un(m![1])).toBe(s.title);
      expect(JSON.parse(un(m![2]))).toEqual({ summary: s.summary, functional: s.functional, scale: s.scale, params: s.params });
      expect(JSON.parse(un(m![3]))).toEqual(s.constraints);
      expect(JSON.parse(un(m![4]))).toEqual(s.rules);
    }
    expect(sql.match(/^\s+\('/gm)?.length).toBe(SCENARIOS.length);
  });
});
