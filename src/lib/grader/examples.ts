// Two reference designs for the ticketing scenario: one that passes with no
// violations and one naive design that fails. Tests grade both, the browser
// check imports them, and the scenario page offers them as starting points.
import { type NodeConfig, type NodeKind, defaultConfig } from "@/lib/canvas/catalog";
import { type DesignEdge, type DesignGraph, GRAPH_SCHEMA } from "@/lib/canvas/graph";

type N = [id: string, kind: NodeKind, x: number, y: number, config?: Partial<NodeConfig>];
type E = [id: string, source: string, target: string, kind: DesignEdge["kind"]];

export function build(nodes: N[], edges: E[]): DesignGraph {
  return {
    schema: GRAPH_SCHEMA,
    nodes: nodes.map(([id, kind, x, y, config]) => ({ id, kind, position: { x, y }, config: { ...defaultConfig(kind), ...config } })),
    edges: edges.map(([id, source, target, kind]) => ({ id, source, target, kind })),
  };
}

export const TICKETING_GOOD: DesignGraph = build(
  [
    ["client", "client", 0, 200, { label: "Buyers" }],
    ["cdn", "cdn", 240, 40, { label: "CDN", qpsIn: 500_000, qpsOut: 5000 }],
    ["assets", "object_store", 480, 40, { label: "Static assets" }],
    ["lb", "load_balancer", 240, 240, { label: "Load balancer", replicas: 2, qpsIn: 150_000 }],
    ["gw", "api_gateway", 480, 240, { label: "API gateway", replicas: 4, qpsIn: 40_000 }],
    ["app", "app_service", 720, 240, { label: "Sale API", replicas: 60, qpsIn: 2000, qpsOut: 5000 }],
    ["cache", "cache", 960, 80, { label: "Availability cache", replicas: 3 }],
    ["queue", "queue", 960, 240, { label: "Purchase queue", qpsOut: 1000 }],
    ["worker", "worker", 1200, 240, { label: "Purchase worker", replicas: 4, qpsOut: 1000 }],
    ["dlq", "queue", 1200, 400, { label: "Purchase dead letter" }],
    ["primary", "sql_db", 1440, 240, { label: "Seat inventory", replicas: 1 }],
    ["replica", "sql_db", 960, 420, { label: "Seats read replica", role: "replica", replicas: 2 }],
  ],
  [
    ["e1", "client", "cdn", "sync"],
    ["e2", "client", "lb", "sync"],
    ["e3", "cdn", "assets", "sync"],
    ["e4", "lb", "gw", "sync"],
    ["e5", "gw", "app", "sync"],
    ["e6", "app", "cache", "cache_read"],
    ["e7", "app", "queue", "sync"],
    ["e8", "app", "replica", "sync"],
    ["e9", "queue", "worker", "async"],
    ["e10", "worker", "primary", "sync"],
    ["e11", "worker", "dlq", "async"],
    ["e12", "primary", "replica", "replication"],
  ],
);

export const TICKETING_NAIVE: DesignGraph = build(
  [
    ["client", "client", 0, 100, { label: "Buyers" }],
    ["app", "app_service", 260, 100, { label: "Ticket app", replicas: 1 }],
    ["db", "sql_db", 520, 100, { label: "Tickets DB" }],
  ],
  [
    ["e1", "client", "app", "sync"],
    ["e2", "app", "db", "sync"],
  ],
);
