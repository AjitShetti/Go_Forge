// Two designs per scenario: a reference that passes with no violations and no
// warnings, and a naive design that fails. Tests grade both, and the scenario
// page offers them as starting points (STARTS, at the bottom).
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

export const URL_GOOD: DesignGraph = build(
  [
    ["client", "client", 0, 160, { label: "People opening links" }],
    ["lb", "load_balancer", 240, 160, { label: "Load balancer", replicas: 2 }],
    ["app", "app_service", 480, 160, { label: "Link API", replicas: 25, qpsOut: 1000 }],
    ["cache", "cache", 720, 40, { label: "Code to URL cache", replicas: 3 }],
    ["primary", "sql_db", 720, 240, { label: "Links DB" }],
    ["replica", "sql_db", 960, 240, { label: "Links replica", role: "replica", replicas: 2 }],
  ],
  [
    ["e1", "client", "lb", "sync"],
    ["e2", "lb", "app", "sync"],
    ["e3", "app", "cache", "cache_read"],
    ["e4", "app", "primary", "sync"],
    ["e5", "primary", "replica", "replication"],
  ],
);

export const URL_NAIVE: DesignGraph = build(
  [
    ["client", "client", 0, 100, { label: "People opening links" }],
    ["app", "app_service", 260, 100, { label: "Shortener", replicas: 1 }],
    ["db", "sql_db", 520, 100, { label: "Links DB" }],
  ],
  [
    ["e1", "client", "app", "sync"],
    ["e2", "app", "db", "sync"],
  ],
);

export const FEED_GOOD: DesignGraph = build(
  [
    ["client", "client", 0, 200, { label: "Readers and authors" }],
    ["lb", "load_balancer", 240, 200, { label: "Load balancer", replicas: 4 }],
    ["app", "app_service", 480, 200, { label: "Feed API", replicas: 100, qpsOut: 5000 }],
    ["cache", "cache", 720, 40, { label: "Feed cache", replicas: 3 }],
    ["feeds", "nosql", 1200, 200, { label: "Precomputed feeds", replicas: 3 }],
    ["queue", "queue", 720, 360, { label: "Fan-out queue", qpsOut: 2000 }],
    ["worker", "worker", 960, 360, { label: "Fan-out workers", replicas: 10, qpsOut: 20_000 }],
    ["dlq", "queue", 1200, 480, { label: "Fan-out dead letter" }],
  ],
  [
    ["e1", "client", "lb", "sync"],
    ["e2", "lb", "app", "sync"],
    ["e3", "app", "cache", "cache_read"],
    ["e4", "app", "feeds", "sync"],
    ["e5", "app", "queue", "async"],
    ["e6", "queue", "worker", "async"],
    ["e7", "worker", "feeds", "sync"],
    ["e8", "worker", "dlq", "async"],
  ],
);

export const FEED_NAIVE: DesignGraph = build(
  [
    ["client", "client", 0, 100, { label: "Readers and authors" }],
    ["app", "app_service", 260, 100, { label: "Feed server", replicas: 1 }],
    ["db", "sql_db", 520, 100, { label: "Posts DB" }],
  ],
  [
    ["e1", "client", "app", "sync"],
    ["e2", "app", "db", "sync"],
  ],
);

export const API_GOOD: DesignGraph = build(
  [
    ["client", "client", 0, 160, { label: "API clients" }],
    ["lb", "load_balancer", 240, 160, { label: "Load balancer", replicas: 4 }],
    ["rl", "rate_limiter", 480, 160, { label: "Rate limiter", replicas: 4, qpsOut: 20_000 }],
    ["counters", "cache", 480, 20, { label: "Limit counters", replicas: 3 }],
    ["app", "app_service", 720, 160, { label: "API servers", replicas: 12, qpsOut: 20_000 }],
    ["data", "nosql", 960, 160, { label: "API data", replicas: 3 }],
  ],
  [
    ["e1", "client", "lb", "sync"],
    ["e2", "lb", "rl", "sync"],
    ["e3", "rl", "counters", "sync"],
    ["e4", "rl", "app", "sync"],
    ["e5", "app", "data", "sync"],
  ],
);

export const API_NAIVE: DesignGraph = build(
  [
    ["client", "client", 0, 100, { label: "API clients" }],
    ["lb", "load_balancer", 220, 100, { label: "Load balancer", replicas: 3 }],
    ["rl", "rate_limiter", 440, 100, { label: "Rate limiter", replicas: 4, qpsOut: 20_000 }],
    ["app", "app_service", 660, 100, { label: "API servers" }],
    ["db", "sql_db", 880, 100, { label: "API DB" }],
  ],
  [
    ["e1", "client", "lb", "sync"],
    ["e2", "lb", "rl", "sync"],
    ["e3", "rl", "app", "sync"],
    ["e4", "app", "db", "sync"],
  ],
);

export const FILES_GOOD: DesignGraph = build(
  [
    ["client", "client", 0, 240, { label: "Uploaders and viewers" }],
    ["cdn", "cdn", 240, 40, { label: "CDN", qpsOut: 2000 }],
    ["objects", "object_store", 720, 40, { label: "File storage", qpsIn: 50_000, storageGb: 11_000_000 }],
    ["lb", "load_balancer", 240, 300, { label: "Load balancer", replicas: 2 }],
    ["app", "app_service", 480, 300, { label: "File API (signs URLs)", replicas: 12, qpsOut: 2000 }],
    ["cache", "cache", 720, 200, { label: "Metadata cache", replicas: 3 }],
    ["db", "sql_db", 720, 380, { label: "File metadata" }],
    ["replica", "sql_db", 960, 380, { label: "Metadata replica", role: "replica", replicas: 2 }],
  ],
  [
    ["e1", "client", "cdn", "sync"],
    ["e2", "client", "objects", "sync"],
    ["e3", "client", "lb", "sync"],
    ["e4", "cdn", "objects", "sync"],
    ["e5", "lb", "app", "sync"],
    ["e6", "app", "cache", "cache_read"],
    ["e7", "app", "db", "sync"],
    ["e8", "db", "replica", "replication"],
  ],
);

export const FILES_NAIVE: DesignGraph = build(
  [
    ["client", "client", 0, 100, { label: "Uploaders and viewers" }],
    ["lb", "load_balancer", 220, 100, { label: "Load balancer" }],
    ["app", "app_service", 440, 100, { label: "File server" }],
    ["objects", "object_store", 660, 20, { label: "Files" }],
    ["db", "sql_db", 660, 180, { label: "Metadata DB" }],
  ],
  [
    ["e1", "client", "lb", "sync"],
    ["e2", "lb", "app", "sync"],
    ["e3", "app", "objects", "sync"],
    ["e4", "app", "db", "sync"],
  ],
);

export const CHAT_GOOD: DesignGraph = build(
  [
    ["client", "client", 0, 200, { label: "Connected people" }],
    ["lb", "load_balancer", 240, 200, { label: "Connection LB", replicas: 10, qpsIn: 100_000 }],
    ["presence-svc", "app_service", 480, 60, { label: "Presence service", replicas: 20, qpsIn: 25_000, qpsOut: 400_000 }],
    ["presence", "cache", 720, 60, { label: "Presence cache", replicas: 3, qpsIn: 200_000 }],
    ["msg-svc", "app_service", 480, 300, { label: "Message service", replicas: 20, qpsIn: 25_000, qpsOut: 100_000 }],
    ["messages", "nosql", 720, 220, { label: "Message store", replicas: 6 }],
    ["topic", "pubsub", 720, 380, { label: "Channel topic", replicas: 6, qpsOut: 100_000 }],
    ["worker", "worker", 960, 380, { label: "Delivery workers", replicas: 250, qpsOut: 100_000 }],
    ["push", "app_service", 1200, 380, { label: "Push gateway", replicas: 10, qpsIn: 20_000 }],
  ],
  [
    ["e1", "client", "lb", "sync"],
    ["e2", "lb", "presence-svc", "sync"],
    ["e3", "presence-svc", "presence", "sync"],
    ["e4", "lb", "msg-svc", "sync"],
    ["e5", "msg-svc", "messages", "sync"],
    ["e6", "msg-svc", "topic", "async"],
    ["e7", "topic", "worker", "async"],
    ["e8", "worker", "push", "sync"],
  ],
);

export const CHAT_NAIVE: DesignGraph = build(
  [
    ["client", "client", 0, 100, { label: "Connected people" }],
    ["app", "app_service", 260, 100, { label: "Chat server", replicas: 1 }],
    ["db", "sql_db", 520, 100, { label: "Chat DB" }],
  ],
  [
    ["e1", "client", "app", "sync"],
    ["e2", "app", "db", "sync"],
  ],
);

/** Starting designs a scenario page links to: /canvas/new?scenario=<slug>&start=<name>. */
export const STARTS: Record<string, { naive: DesignGraph; reference: DesignGraph }> = {
  "ticketing-flash-sale": { naive: TICKETING_NAIVE, reference: TICKETING_GOOD },
  "url-shortener": { naive: URL_NAIVE, reference: URL_GOOD },
  "news-feed-fanout": { naive: FEED_NAIVE, reference: FEED_GOOD },
  "rate-limited-public-api": { naive: API_NAIVE, reference: API_GOOD },
  "file-storage-cdn": { naive: FILES_NAIVE, reference: FILES_GOOD },
  "chat-presence": { naive: CHAT_NAIVE, reference: CHAT_GOOD },
};
