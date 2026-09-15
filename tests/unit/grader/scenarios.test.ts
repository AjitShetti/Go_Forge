import { describe, expect, it } from "vitest";
import { type DesignGraph, parseGraph } from "@/lib/canvas/graph";
import { API_GOOD, CHAT_GOOD, FEED_GOOD, FILES_GOOD, STARTS, build } from "@/lib/grader/examples";
import { grade } from "@/lib/grader/grade";
import { CHAT_PRESENCE, FILE_STORAGE_CDN, NEWS_FEED_FANOUT, RATE_LIMITED_API, SCENARIOS, URL_SHORTENER } from "@/lib/grader/scenarios";
import type { GradeReport, RuleId } from "@/lib/grader/types";

const all = (r: GradeReport) => [...r.violations, ...r.warnings, ...r.tradeoffs];
const only = (r: GradeReport, rule: RuleId) => all(r).filter((f) => f.rule === rule);
const sorted = (fs: { rule: RuleId }[]) => fs.map((f) => f.rule).sort();
const clone = (g: DesignGraph): DesignGraph => JSON.parse(JSON.stringify(g));
const setNode = (g: DesignGraph, id: string, patch: object) => {
  const n = g.nodes.find((x) => x.id === id)!;
  n.config = { ...n.config, ...patch };
  return g;
};

// Expected grades of every scenario's two starting designs. The scenario page
// offers both, and scripts/verify-scenarios.mjs checks the same numbers in the browser.
const EXPECTED: Record<string, { reference: RuleId[]; naive: { score: number; violations: RuleId[]; warnings: RuleId[] } }> = {
  "ticketing-flash-sale": { reference: ["load-shedding", "load-shedding", "queue-backlog", "replica-reads"], naive: { score: 35, violations: ["admission-queue", "capacity", "spof", "spof"], warnings: ["read-heavy-cache"] } },
  "url-shortener": { reference: ["load-shedding"], naive: { score: 50, violations: ["capacity", "spof", "spof"], warnings: ["read-heavy-cache"] } },
  "news-feed-fanout": { reference: ["load-shedding", "queue-backlog"], naive: { score: 35, violations: ["async-fanout", "capacity", "spof", "spof"], warnings: ["read-heavy-cache"] } },
  "rate-limited-public-api": { reference: ["load-shedding"], naive: { score: 55, violations: ["capacity", "limiter-shared-state", "spof"], warnings: [] } },
  "file-storage-cdn": { reference: ["load-shedding", "load-shedding"], naive: { score: 20, violations: ["blob-through-app", "capacity", "cdn-for-blobs", "spof", "storage-capacity"], warnings: ["read-heavy-cache"] } },
  "chat-presence": { reference: ["load-shedding"], naive: { score: 25, violations: ["async-fanout", "capacity", "presence-store", "spof", "spof"], warnings: [] } },
};

describe("seed scenarios", () => {
  it("there are six, with unique slugs, 3–5 constraints each, and starting designs for every one", () => {
    expect(SCENARIOS.map((s) => s.slug)).toEqual(Object.keys(EXPECTED));
    for (const s of SCENARIOS) {
      expect(s.constraints.length, s.slug).toBeGreaterThanOrEqual(3);
      expect(s.constraints.length, s.slug).toBeLessThanOrEqual(5);
      expect(STARTS[s.slug], s.slug).toBeDefined();
      expect(parseGraph(STARTS[s.slug].naive).ok).toBe(true);
      expect(parseGraph(STARTS[s.slug].reference).ok).toBe(true);
    }
  });

  it("every enabled rule is cited by a constraint, and rules that need a parameter have it", () => {
    for (const s of SCENARIOS) {
      const cited = new Set(s.constraints.flatMap((c) => c.rules));
      for (const { rule } of s.rules) if (rule !== "has-entry" && rule !== "unreachable") expect(cited.has(rule), `${s.slug}/${rule}`).toBe(true);
      const enabled = new Set(s.rules.map((r) => r.rule));
      if (enabled.has("limiter-shared-state")) expect(s.params.perKeyLimitRps, s.slug).toBeGreaterThan(0);
      if (enabled.has("blob-through-app")) expect(s.params.avgObjectMb, s.slug).toBeGreaterThan(0);
      if (enabled.has("storage-capacity")) expect(s.params.storage?.requiredGb, s.slug).toBeGreaterThan(0);
      for (const r of Object.keys(s.why ?? {})) expect(enabled.has(r as RuleId), `${s.slug} why/${r}`).toBe(true);
    }
  });

  for (const s of SCENARIOS) {
    const exp = EXPECTED[s.slug];
    it(`${s.slug}: the reference passes with 100, no warnings, and only tradeoffs`, () => {
      const r = grade(STARTS[s.slug].reference, s);
      expect(r.violations.map((f) => f.detail)).toEqual([]);
      expect(r.warnings.map((f) => f.detail)).toEqual([]);
      expect(r.score).toBe(100);
      expect(sorted(r.tradeoffs)).toEqual(exp.reference);
    });
    it(`${s.slug}: the naive design fails with score ${exp.naive.score}`, () => {
      const r = grade(STARTS[s.slug].naive, s);
      expect(r.passed).toBe(false);
      expect(sorted(r.violations)).toEqual(exp.naive.violations);
      expect(sorted(r.warnings)).toEqual(exp.naive.warnings);
      expect(r.score).toBe(exp.naive.score);
    });
  }

  it("a scenario's why sentence is appended to that rule's findings only", () => {
    const [f] = only(grade(STARTS["url-shortener"].naive, { ...URL_SHORTENER, why: { capacity: "Redirects fail." } }), "capacity");
    expect(f.detail).toMatch(/can accept 2,000 rps\. Redirects fail\.$/);
    expect(only(grade(STARTS["url-shortener"].naive, URL_SHORTENER), "spof")[0].detail).not.toMatch(/Redirects fail/);
  });
});

describe("P7 rules cite the numbers that triggered them", () => {
  it("dead-letter connections carry no load, and the report says so", () => {
    const r = grade(FEED_GOOD, NEWS_FEED_FANOUT);
    expect(r.load.dlq).toBeUndefined();
    expect(r.load.feeds).toBe(25_000);
    expect(r.assumptions).toContain("Connections into Fan-out dead letter carry no load: failed messages are assumed rare.");
  });

  it("async-fanout: a worker the sender waits on is named with its path", () => {
    const g = clone(FEED_GOOD);
    g.edges.find((e) => e.id === "e5")!.kind = "sync";
    g.edges.find((e) => e.id === "e6")!.kind = "sync";
    const fs = only(grade(g, NEWS_FEED_FANOUT), "async-fanout");
    expect(fs.map((f) => f.title)).toEqual(["Fan-out has no asynchronous hand-off", "The sender waits on fan-out work"]);
    expect(fs[1].math).toEqual(["path: Readers and authors → Load balancer → Feed API → Fan-out queue → Fan-out workers", "async connections on this path = 0"]);
    expect(fs[0].detail).toMatch(/30,000,000 feed writes\.$/);
  });

  it("rate-limit-entry: a path around the limiter is named, and stops at the first backend node", () => {
    const g = clone(API_GOOD);
    g.edges.push({ id: "bypass", source: "lb", target: "app", kind: "sync" });
    const fs = only(grade(g, RATE_LIMITED_API), "rate-limit-entry");
    expect(fs).toHaveLength(1);
    expect(fs[0].math).toEqual(["path: API clients → Load balancer → API servers", "Rate Limiter nodes on this path = 0"]);
    expect(fs[0].edgeIds).toEqual(["e1", "bypass"]);
  });

  it("limiter-shared-state: replicas × per-key limit; a counter store or a single replica clears it", () => {
    const g = clone(API_GOOD);
    g.edges = g.edges.filter((e) => e.id !== "e3");
    const [f] = only(grade(g, RATE_LIMITED_API), "limiter-shared-state");
    expect(f.math).toEqual(["4 replicas × 100 rps per key = 400 rps per key actually allowed", "Cache or NoSQL connections from Rate limiter = 0"]);
    // Removing the counters leaves them unreachable too.
    expect(only(grade(g, RATE_LIMITED_API), "unreachable")).toHaveLength(1);
    expect(only(grade(setNode(g, "rl", { replicas: 1, qpsIn: 200_000 }), RATE_LIMITED_API), "limiter-shared-state")).toEqual([]);
  });

  it("blob-through-app: bandwidth is computed from the scenario's uploads and file size", () => {
    const [f] = only(grade(STARTS["file-storage-cdn"].naive, FILE_STORAGE_CDN), "blob-through-app");
    expect(f.severity).toBe("violation");
    expect(f.math).toEqual(["path: Uploaders and viewers → Load balancer → File server → Files", "uploads at peak = 50,000 ÷ (49 + 1) = 1,000 per second", "upload bytes through File server = 1,000 × 5 MB = 5,000 MB/s (40 Gbps)"]);
    // A client talking to storage directly, or through a CDN, is not a byte path.
    expect(only(grade(FILES_GOOD, FILE_STORAGE_CDN), "blob-through-app")).toEqual([]);
  });

  it("cdn-for-blobs and storage-capacity show downloads and the storage shortfall", () => {
    const g = clone(FILES_GOOD);
    g.edges = g.edges.filter((e) => e.id !== "e4");
    setNode(g, "objects", { storageGb: 1_000_000 });
    const r = grade(g, FILE_STORAGE_CDN);
    expect(only(r, "cdn-for-blobs")[0].math).toEqual(["downloads at peak = 50,000 × 49 ÷ 50 = 49,000 rps", "CDN → Object Store connections = 0"]);
    expect(only(r, "storage-capacity")[0].math).toEqual(["File storage: 1,000,000 GB", "total = 1,000,000 GB < 11,000,000 GB required", "short by 10,000,000 GB"]);
    const noStore = grade(build([["c", "client", 0, 0], ["api", "app_service", 0, 0, { replicas: 30 }]], [["e", "c", "api", "sync"]]), FILE_STORAGE_CDN);
    expect(only(noStore, "storage-capacity")[0].detail).toMatch(/No persistent Object Store is on the request path/);
    expect(only(noStore, "cdn-for-blobs")).toEqual([]);
  });

  it("presence-store: a persistent presence store is flagged with the heartbeat load it takes", () => {
    const g = clone(CHAT_GOOD);
    const p = g.nodes.find((n) => n.id === "presence")!;
    p.kind = "nosql";
    p.config = { label: "Presence table", replicas: 30, region: "us-east-1", qpsIn: 20_000, p99Ms: 5, storageGb: 10, consistency: "eventual", persistence: true };
    const [f] = only(grade(g, CHAT_PRESENCE), "presence-store");
    expect(f.title).toBe("Presence written to durable storage");
    expect(f.math).toEqual(["Presence table: persistence = true", "heartbeat load arriving = 400,000 rps"]);
    p.config.persistence = false;
    expect(only(grade(g, CHAT_PRESENCE), "presence-store")).toEqual([]);
  });

  it("durable-store: message stores with persistence off are listed", () => {
    const g = setNode(clone(CHAT_GOOD), "messages", { persistence: false });
    const [f] = only(grade(g, CHAT_PRESENCE), "durable-store");
    expect(f.math).toEqual(["Message store: persistence = false"]);
  });
});
