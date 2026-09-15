// The design canvas vocabulary: node kinds, edge kinds and the config fields
// each node exposes. The P6 grader reads the same config, so every field here
// has one stated meaning and unit.

export const NODE_KINDS = [
  "client",
  "cdn",
  "load_balancer",
  "api_gateway",
  "app_service",
  "worker",
  "queue",
  "cache",
  "sql_db",
  "nosql",
  "object_store",
  "search_index",
  "rate_limiter",
  "pubsub",
  "cron",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_KINDS = ["sync", "async", "replication", "cache_read", "batch"] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const REGIONS = ["global", "us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1", "ap-southeast-1", "sa-east-1"] as const;
export type Region = (typeof REGIONS)[number];

export const CONSISTENCY = ["strong", "eventual"] as const;
export type Consistency = (typeof CONSISTENCY)[number];

export const DB_ROLES = ["primary", "replica"] as const;
export type DbRole = (typeof DB_ROLES)[number];

export type NodeConfig = {
  label: string;
  /** Identical instances behind this node. */
  replicas?: number;
  region?: Region;
  /** Requests (or messages/jobs) per second ONE replica can accept. Node capacity = replicas × qpsIn. */
  qpsIn?: number;
  /** Requests per second this node sends downstream at its expected load. */
  qpsOut?: number;
  /** 99th percentile latency this node adds, in milliseconds. */
  p99Ms?: number;
  /** Data held, in gigabytes. */
  storageGb?: number;
  consistency?: Consistency;
  /** Survives a restart of the process holding it. */
  persistence?: boolean;
  /** SQL DB only. */
  role?: DbRole;
};

export type FieldKey = Exclude<keyof NodeConfig, "label">;

export type NumberField = { key: "replicas" | "qpsIn" | "qpsOut" | "p99Ms" | "storageGb"; type: "number"; label: string; unit: string; min: number; max: number; integer: boolean };
export type FieldSpec =
  | NumberField
  | { key: "region"; type: "select"; label: string; options: readonly Region[] }
  | { key: "consistency"; type: "select"; label: string; options: readonly Consistency[] }
  | { key: "role"; type: "select"; label: string; options: readonly DbRole[] }
  | { key: "persistence"; type: "boolean"; label: string };

export const FIELDS: Record<FieldKey, FieldSpec> = {
  replicas: { key: "replicas", type: "number", label: "Replicas", unit: "×", min: 1, max: 1000, integer: true },
  region: { key: "region", type: "select", label: "Region", options: REGIONS },
  qpsIn: { key: "qpsIn", type: "number", label: "QPS in (per replica)", unit: "rps", min: 0, max: 10_000_000, integer: true },
  qpsOut: { key: "qpsOut", type: "number", label: "QPS out", unit: "rps", min: 0, max: 10_000_000, integer: true },
  p99Ms: { key: "p99Ms", type: "number", label: "p99 latency", unit: "ms", min: 0, max: 600_000, integer: false },
  storageGb: { key: "storageGb", type: "number", label: "Storage", unit: "GB", min: 0, max: 100_000_000, integer: false },
  consistency: { key: "consistency", type: "select", label: "Consistency", options: CONSISTENCY },
  persistence: { key: "persistence", type: "boolean", label: "Persistent" },
  role: { key: "role", type: "select", label: "Role", options: DB_ROLES },
};

/** Display order of fields in the inspector and in exported JSON. */
export const FIELD_ORDER: FieldKey[] = ["role", "replicas", "region", "qpsIn", "qpsOut", "p99Ms", "storageGb", "consistency", "persistence"];

export type NodeSpec = {
  kind: NodeKind;
  title: string;
  /** One line on what the node stands for, shown in the palette. */
  blurb: string;
  /** Holds data that matters if the node dies (the P6 SPOF rule reads this). */
  stateful: boolean;
  defaults: Omit<NodeConfig, "label">;
};

export const NODE_SPECS: Record<NodeKind, NodeSpec> = {
  client: { kind: "client", title: "Client / Mobile", blurb: "Browsers and apps making requests", stateful: false, defaults: { region: "global", qpsOut: 1000 } },
  cdn: { kind: "cdn", title: "CDN", blurb: "Edge cache for static and cacheable responses", stateful: false, defaults: { region: "global", qpsIn: 100_000, qpsOut: 1000, p99Ms: 20, storageGb: 100 } },
  load_balancer: { kind: "load_balancer", title: "Load Balancer", blurb: "Spreads connections across replicas", stateful: false, defaults: { replicas: 2, region: "us-east-1", qpsIn: 50_000, qpsOut: 1000, p99Ms: 2 } },
  api_gateway: { kind: "api_gateway", title: "API Gateway", blurb: "Auth, routing and request shaping at the edge", stateful: false, defaults: { replicas: 2, region: "us-east-1", qpsIn: 10_000, qpsOut: 1000, p99Ms: 10 } },
  app_service: { kind: "app_service", title: "App Service", blurb: "Stateless request handlers", stateful: false, defaults: { replicas: 3, region: "us-east-1", qpsIn: 2000, qpsOut: 1000, p99Ms: 50 } },
  worker: { kind: "worker", title: "Worker", blurb: "Background consumers of queued work", stateful: false, defaults: { replicas: 2, region: "us-east-1", qpsIn: 500, qpsOut: 100, p99Ms: 200 } },
  queue: { kind: "queue", title: "Message Queue", blurb: "Durable point-to-point work queue", stateful: true, defaults: { replicas: 3, region: "us-east-1", qpsIn: 10_000, qpsOut: 1000, storageGb: 50, persistence: true } },
  cache: { kind: "cache", title: "Cache", blurb: "In-memory key-value store", stateful: true, defaults: { replicas: 1, region: "us-east-1", qpsIn: 50_000, p99Ms: 1, storageGb: 16, consistency: "eventual", persistence: false } },
  sql_db: { kind: "sql_db", title: "SQL DB", blurb: "Relational database, primary or read replica", stateful: true, defaults: { role: "primary", replicas: 1, region: "us-east-1", qpsIn: 5000, p99Ms: 10, storageGb: 500, consistency: "strong", persistence: true } },
  nosql: { kind: "nosql", title: "NoSQL Store", blurb: "Partitioned key-value or document store", stateful: true, defaults: { replicas: 3, region: "us-east-1", qpsIn: 20_000, p99Ms: 5, storageGb: 1000, consistency: "eventual", persistence: true } },
  object_store: { kind: "object_store", title: "Object Store", blurb: "Blobs: files, images, backups", stateful: true, defaults: { region: "us-east-1", qpsIn: 5000, p99Ms: 50, storageGb: 10_000, consistency: "strong", persistence: true } },
  search_index: { kind: "search_index", title: "Search Index", blurb: "Inverted index for full-text queries", stateful: true, defaults: { replicas: 2, region: "us-east-1", qpsIn: 2000, p99Ms: 30, storageGb: 200, consistency: "eventual", persistence: true } },
  rate_limiter: { kind: "rate_limiter", title: "Rate Limiter", blurb: "Rejects traffic above a budget", stateful: false, defaults: { replicas: 2, region: "us-east-1", qpsIn: 50_000, qpsOut: 1000, p99Ms: 1 } },
  pubsub: { kind: "pubsub", title: "Pub/Sub Topic", blurb: "Fan-out of events to many subscribers", stateful: true, defaults: { replicas: 3, region: "us-east-1", qpsIn: 20_000, qpsOut: 20_000, persistence: true } },
  cron: { kind: "cron", title: "Cron", blurb: "Scheduled trigger", stateful: false, defaults: { region: "us-east-1", qpsOut: 1 } },
};

/** The config fields a node kind exposes: exactly the keys in its defaults. */
export function fieldsFor(kind: NodeKind): FieldKey[] {
  const d = NODE_SPECS[kind].defaults;
  return FIELD_ORDER.filter((k) => k in d);
}

export type EdgeSpec = { kind: EdgeKind; title: string; short: string; blurb: string };

export const EDGE_SPECS: Record<EdgeKind, EdgeSpec> = {
  sync: { kind: "sync", title: "Sync request", short: "SYNC", blurb: "Caller waits for the response" },
  async: { kind: "async", title: "Async event", short: "ASYNC", blurb: "Fire and forget; the receiver processes later" },
  replication: { kind: "replication", title: "Replication", short: "REPL", blurb: "Data copied from source to target" },
  cache_read: { kind: "cache_read", title: "Cache read-through", short: "CACHE", blurb: "Read the cache first, fall back to the source" },
  batch: { kind: "batch", title: "Batch / ETL", short: "BATCH", blurb: "Bulk movement on a schedule" },
};

export function defaultConfig(kind: NodeKind): NodeConfig {
  return { label: NODE_SPECS[kind].title, ...NODE_SPECS[kind].defaults };
}
