import { describe, expect, it } from "vitest";
import { EDGE_KINDS, EDGE_SPECS, FIELDS, NODE_KINDS, NODE_SPECS, defaultConfig, fieldsFor } from "@/lib/canvas/catalog";
import {
  type DesignGraph,
  GRAPH_SCHEMA,
  LIMITS,
  canonicalGraph,
  connectionProblem,
  diffGraphs,
  diffIsEmpty,
  exportDesign,
  importDesign,
  parseGraph,
  sameGraph,
} from "@/lib/canvas/graph";

const g = (nodes: unknown[], edges: unknown[] = []) => ({ schema: GRAPH_SCHEMA, nodes, edges });
const node = (id: string, kind = "app_service", extra: Record<string, unknown> = {}) => ({ id, kind, position: { x: 0, y: 0 }, ...extra });
const errorsOf = (raw: unknown) => {
  const r = parseGraph(raw);
  return r.ok ? [] : r.errors;
};

function sample(): DesignGraph {
  const r = parseGraph(
    g(
      [node("client-1", "client"), node("lb-1", "load_balancer"), node("app-1", "app_service", { config: { label: "Orders API", replicas: 4 } }), node("db-1", "sql_db"), node("cache-1", "cache")],
      [
        { id: "e1", source: "client-1", target: "lb-1", kind: "sync" },
        { id: "e2", source: "lb-1", target: "app-1", kind: "sync" },
        { id: "e3", source: "app-1", target: "cache-1", kind: "cache_read" },
        { id: "e4", source: "app-1", target: "db-1", kind: "sync", label: "writes" },
      ],
    ),
  );
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.value;
}

describe("catalog", () => {
  it("has the 15 node kinds and 5 edge kinds from the spec", () => {
    expect(NODE_KINDS).toHaveLength(15);
    expect(EDGE_KINDS).toHaveLength(5);
    expect(Object.keys(NODE_SPECS).sort()).toEqual([...NODE_KINDS].sort());
    expect(Object.keys(EDGE_SPECS).sort()).toEqual([...EDGE_KINDS].sort());
  });

  it("every kind's defaults are valid under its own field specs", () => {
    for (const kind of NODE_KINDS) {
      const r = parseGraph(g([{ id: "n", kind, position: { x: 0, y: 0 }, config: defaultConfig(kind) }]));
      expect(r.ok, `${kind}: ${r.ok ? "" : r.errors.join("; ")}`).toBe(true);
      expect(fieldsFor(kind).length).toBeGreaterThan(0);
    }
  });

  it("only SQL DB has the primary/replica role; stateful kinds carry storage or persistence", () => {
    expect(NODE_KINDS.filter((k) => fieldsFor(k).includes("role"))).toEqual(["sql_db"]);
    for (const k of NODE_KINDS.filter((k) => NODE_SPECS[k].stateful)) {
      expect(fieldsFor(k).some((f) => f === "storageGb" || f === "persistence"), k).toBe(true);
    }
  });

  it("every config field from §6 exists: replicas, region, QPS in/out, p99, storage, consistency, persistence", () => {
    expect(Object.keys(FIELDS).sort()).toEqual(["consistency", "p99Ms", "persistence", "qpsIn", "qpsOut", "region", "replicas", "role", "storageGb"]);
  });
});

describe("parseGraph", () => {
  it("fills missing config with the kind's defaults", () => {
    const r = parseGraph(g([node("a", "sql_db")]));
    expect(r.ok && r.value.nodes[0].config).toEqual(defaultConfig("sql_db"));
  });

  it("keeps valid overrides", () => {
    const r = parseGraph(g([node("a", "sql_db", { config: { label: "Replica", role: "replica", replicas: 2, persistence: true } })]));
    expect(r.ok && r.value.nodes[0].config).toMatchObject({ label: "Replica", role: "replica", replicas: 2 });
  });

  it.each([
    [{}, /schema/],
    [{ schema: "other" }, /schema/],
    [g([node("a", "mainframe")]), /"mainframe" is not a node kind/],
    [g([node("a"), node("a")]), /used twice/],
    [g([node("bad id!")]), /id must be/],
    [g([{ id: "a", kind: "cache", position: { x: Number.NaN, y: 0 } }]), /position/],
    [g([node("a", "cache", { config: { replicas: 0 } })]), /replicas must be an integer from 1/],
    [g([node("a", "cache", { config: { replicas: 2.5 } })]), /replicas must be an integer/],
    [g([node("a", "cache", { config: { replicas: "3" } })]), /replicas must be an integer/],
    [g([node("a", "cache", { config: { consistency: "linearizable" } })]), /consistency must be one of strong, eventual/],
    [g([node("a", "cache", { config: { persistence: "yes" } })]), /persistence must be true or false/],
    [g([node("a", "cache", { config: { role: "primary" } })]), /role is not a field of cache/],
    [g([node("a", "cache", { config: { label: "" } })]), /label must be/],
    [g([node("a")], [{ id: "e", source: "a", target: "zzz", kind: "sync" }]), /target "zzz" is not a node/],
    [g([node("a")], [{ id: "e", source: "a", target: "a", kind: "sync" }]), /to itself/],
    [g([node("a"), node("b")], [{ id: "e", source: "a", target: "b", kind: "telepathy" }]), /not an edge kind/],
    [
      g(
        [node("a"), node("b")],
        [
          { id: "e1", source: "a", target: "b", kind: "sync" },
          { id: "e2", source: "a", target: "b", kind: "sync" },
        ],
      ),
      /duplicates/,
    ],
  ])("rejects %j", (raw, message) => {
    const errors = errorsOf(raw);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toMatch(message);
  });

  it("allows two edges of different kinds, or opposite directions, between the same nodes", () => {
    const r = parseGraph(
      g(
        [node("a"), node("b")],
        [
          { id: "e1", source: "a", target: "b", kind: "sync" },
          { id: "e2", source: "a", target: "b", kind: "async" },
          { id: "e3", source: "b", target: "a", kind: "sync" },
        ],
      ),
    );
    expect(r.ok).toBe(true);
  });

  it("enforces the node limit", () => {
    const nodes = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => node(`n${i}`));
    expect(errorsOf(g(nodes)).join()).toMatch(/at most 200 nodes/);
  });
});

describe("connectionProblem", () => {
  it("refuses self-loops and exact duplicates, allows a new kind", () => {
    const s = sample();
    expect(connectionProblem(s, "app-1", "app-1", "sync")).toMatch(/itself/);
    expect(connectionProblem(s, "app-1", "db-1", "sync")).toMatch(/already exists/);
    expect(connectionProblem(s, "app-1", "db-1", "async")).toBeNull();
  });
});

describe("export / import", () => {
  it("round-trips a design exactly", () => {
    const s = sample();
    const text = exportDesign("Ticketing v1", 3, s, { scenario: "ticketing-flash-sale", now: new Date("2026-09-15T00:00:00Z") });
    const back = importDesign(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value.name).toBe("Ticketing v1");
    expect(back.value.scenario).toBe("ticketing-flash-sale");
    expect(back.value.graph).toEqual(canonicalGraph(s));
    expect(JSON.parse(text)).toMatchObject({ schema: "go-forge/design-export@1", version: 3, exportedAt: "2026-09-15T00:00:00.000Z" });
  });

  it("imports files exported before the scenario field existed", () => {
    const old = JSON.parse(exportDesign("Old", null, sample()));
    delete old.scenario;
    const r = importDesign(JSON.stringify(old));
    expect(r.ok && r.value.scenario).toBeNull();
    expect(importDesign(JSON.stringify({ ...old, scenario: 42 })).ok).toBe(false);
  });

  it("accepts a bare graph", () => {
    const r = importDesign(JSON.stringify(sample()));
    expect(r.ok && r.value.name).toBeNull();
  });

  it("explains bad files instead of loading them", () => {
    const bad = (t: string) => {
      const r = importDesign(t);
      return r.ok ? "" : r.errors.join("\n");
    };
    expect(bad("{nope")).toMatch(/not valid JSON/);
    expect(bad('{"hello": 1}')).toMatch(/not a Go Forge design/);
    expect(bad(JSON.stringify({ schema: "go-forge/design-export@1", name: "x", graph: g([node("a", "ufo")]) }))).toMatch(/graph\.nodes\[0\]\.kind "ufo"/);
    expect(bad(JSON.stringify({ schema: "go-forge/design-export@1", name: "  ", graph: g([]) }))).toMatch(/name must be/);
  });
});

describe("sameGraph and diffGraphs", () => {
  it("ignores key order and sub-0.05px jitter", () => {
    const a = sample();
    const b = structuredClone(a);
    b.nodes[0].position.x += 0.04;
    b.nodes[0].config = { ...b.nodes[0].config };
    expect(sameGraph(a, b)).toBe(true);
    expect(diffIsEmpty(diffGraphs(a, b))).toBe(true);
  });

  it("reports added, removed and changed nodes and edges, and moves separately", () => {
    const a = sample();
    const b = structuredClone(a);
    b.nodes = b.nodes.filter((n) => n.id !== "cache-1");
    b.edges = b.edges.filter((e) => e.target !== "cache-1");
    b.nodes.find((n) => n.id === "app-1")!.config.replicas = 8;
    b.nodes.find((n) => n.id === "db-1")!.config.role = "replica";
    b.nodes.find((n) => n.id === "lb-1")!.position = { x: 300, y: 40 };
    b.nodes.push({ id: "q-1", kind: "queue", position: { x: 10, y: 10 }, config: defaultConfig("queue") });
    b.edges.push({ id: "e5", source: "app-1", target: "q-1", kind: "async" });
    b.edges.find((e) => e.id === "e4")!.kind = "async";

    const d = diffGraphs(a, b);
    expect(d.addedNodes.map((n) => n.id)).toEqual(["q-1"]);
    expect(d.removedNodes.map((n) => n.id)).toEqual(["cache-1"]);
    expect(d.changedNodes.map((c) => [c.after.id, c.changes])).toEqual([
      ["app-1", [{ field: "replicas", from: 4, to: 8 }]],
      ["db-1", [{ field: "role", from: "primary", to: "replica" }]],
    ]);
    expect(d.movedNodes).toEqual(["lb-1"]);
    expect(d.addedEdges.map((e) => e.id)).toEqual(["e5"]);
    expect(d.removedEdges.map((e) => e.id)).toEqual(["e3"]);
    expect(d.changedEdges.map((c) => c.changes)).toEqual([[{ field: "kind", from: "sync", to: "async" }]]);
    expect(diffIsEmpty(d)).toBe(false);
  });

  it("treats a re-pointed edge as removed + added", () => {
    const a = sample();
    const b = structuredClone(a);
    b.edges.find((e) => e.id === "e4")!.target = "cache-1";
    const d = diffGraphs(a, b);
    expect(d.removedEdges.map((e) => e.target)).toEqual(["db-1"]);
    expect(d.addedEdges.map((e) => e.target)).toEqual(["cache-1"]);
  });
});
