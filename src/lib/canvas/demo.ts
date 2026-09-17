// The home page's canvas walkthrough: the URL shortener built up one move at a
// time. Scores shown on the page come from grade() at render time, and
// tests/unit/grader/demo.test.ts pins them, so the walkthrough can't drift
// from what the real canvas would say.
import type { DesignGraph } from "./graph";
import { build } from "@/lib/grader/examples";
import { URL_SHORTENER } from "@/lib/grader/scenarios";

export const DEMO_SCENARIO = URL_SHORTENER;

export type DemoStep = {
  key: string;
  title: string;
  /** What the learner does on the real canvas, one action per line. */
  actions: string[];
  /** Why, in a sentence or two. */
  note: string;
  graph: DesignGraph;
  /** Show the grade report for this step. */
  graded: boolean;
  /** Mark what changed against the previous step (Added / Changed badges). */
  markChanges: boolean;
  /** Worked arithmetic shown under the actions, when the step is about numbers. */
  math?: string[];
};

const CLIENT = ["client", "client", 0, 150, { label: "Visitors" }] as const;
const LB = ["lb", "load_balancer", 270, 150, { label: "Load balancer", replicas: 2 }] as const;
const DB = ["db", "sql_db", 810, 270, { label: "Links DB" }] as const;
const CACHE = ["cache", "cache", 810, 20, { label: "URL cache", replicas: 3 }] as const;
const REPLICA = ["replica", "sql_db", 810, 420, { label: "Links replica", role: "replica", replicas: 2 }] as const;

const naive = build(
  [[...CLIENT], ["app", "app_service", 540, 150, { label: "Shortener", replicas: 1 }], [...DB]],
  [
    ["e-client-app", "client", "app", "sync"],
    ["e-app-db", "app", "db", "sync"],
  ],
);

const scaled = build(
  [[...CLIENT], [...LB], ["app", "app_service", 540, 150, { label: "Link API", replicas: 25, qpsOut: 1000 }], [...DB]],
  [
    ["e-client-lb", "client", "lb", "sync"],
    ["e-lb-app", "lb", "app", "sync"],
    ["e-app-db", "app", "db", "sync"],
  ],
);

const cached: DesignGraph = {
  ...scaled,
  nodes: [...scaled.nodes, ...build([[...CACHE]], []).nodes],
  edges: [...scaled.edges, { id: "e-app-cache", source: "app", target: "cache", kind: "cache_read" }],
};

const replicated: DesignGraph = {
  ...cached,
  nodes: [...cached.nodes, ...build([[...REPLICA]], []).nodes],
  edges: [...cached.edges, { id: "e-db-replica", source: "db", target: "replica", kind: "replication" }],
};

const empty = build([], []);

export const DEMO_STEPS: DemoStep[] = [
  {
    key: "scenario",
    title: "Pick a scenario",
    actions: ["Canvas → New design", "Scenario menu → URL shortener", "Or open Scenarios and press Start from a naive design"],
    note: "A scenario is the brief: what the system does, the load it has to survive, and the hard constraints the grader checks.",
    graph: empty,
    graded: false,
    markChanges: false,
  },
  {
    key: "sketch",
    title: "Sketch it",
    actions: ["Drag Client, App Service and SQL DB out of the Components palette", "Hover a box and drag from the small square on its side to another box", "Select a box to rename it in the inspector"],
    note: "Arrows point from caller to callee. New connections are Sync requests unless you pick another kind in the inspector first.",
    graph: naive,
    graded: false,
    markChanges: true,
  },
  {
    key: "grade",
    title: "Grade it",
    actions: ["Press Grade", "Read each finding and its arithmetic", "Press show on canvas to jump to the box that caused it"],
    note: "The grader is a fixed set of rules, so the same design always gets the same score: 100, minus 15 per violation and 5 per warning.",
    graph: naive,
    graded: true,
    markChanges: false,
  },
  {
    key: "scale",
    title: "Scale the request path",
    actions: ["Add a Load Balancer between the clients and the app", "Select the app → set Replicas to 25", "Delete the old Client → App arrow"],
    note: "Capacity is replicas × QPS in per replica. One replica also means one crash takes the site down.",
    graph: scaled,
    graded: true,
    markChanges: true,
    math: ["25 replicas × 2,000 rps each", "= 50,000 rps ≥ 40,400 rps peak"],
  },
  {
    key: "cache",
    title: "Cache the reads",
    actions: ["Inspector → New connections → Cache read-through", "Add a Cache and connect App → Cache"],
    note: "Redirects outnumber new links 100 to 1. A read-through cache answers most of them without touching the database.",
    graph: cached,
    graded: true,
    markChanges: true,
  },
  {
    key: "replicate",
    title: "Replicate the data",
    actions: ["Add a second SQL DB → Role: replica", "Connect Links DB → replica as Replication", "Save as v2, then History → diff against v1"],
    note: "The database was the last single point of failure. Every save is a new version, so you can compare before and after.",
    graph: replicated,
    graded: true,
    markChanges: true,
  },
];
