// Shapes shared by the rule engine, the scenarios and the report UI.
import type { NodeKind } from "@/lib/canvas/catalog";
import type { DesignGraph } from "@/lib/canvas/graph";

export type Severity = "violation" | "warning" | "tradeoff";

export type RuleId =
  | "has-entry"
  | "client-direct-data"
  | "spof"
  | "capacity"
  | "read-heavy-cache"
  | "queue-dlq"
  | "strong-inventory"
  | "admission-queue"
  | "latency-budget"
  | "load-shedding"
  | "cross-region-sync"
  | "replica-reads"
  | "queue-backlog"
  | "unreachable"
  // P7 scenario rules
  | "async-fanout"
  | "rate-limit-entry"
  | "limiter-shared-state"
  | "blob-through-app"
  | "cdn-for-blobs"
  | "storage-capacity"
  | "presence-store"
  | "durable-store";

/** One enabled rule in a scenario. `severity` overrides the rule's default. */
export type RuleConfig = { rule: RuleId; severity?: Severity };

export type Scenario = {
  slug: string;
  title: string;
  summary: string;
  functional: string[];
  scale: {
    /** Requests per second arriving from all clients together at the worst moment. */
    peakQps: number;
    /** Reads per write. */
    readWriteRatio: number;
    /** Other numbers worth stating, shown as-is. */
    notes: { label: string; value: string }[];
  };
  /** Hard constraints in plain words. Each lists the rules that enforce it. */
  constraints: { id: string; text: string; rules: RuleId[] }[];
  params: {
    /** read-heavy-cache fires when readWriteRatio is at least this. */
    readHeavyRatio: number;
    /** latency-budget: allowed p99 sum along the slowest synchronous path. */
    p99BudgetMs: number;
    /** limiter-shared-state: the per-key limit each limiter replica would enforce on its own. */
    perKeyLimitRps?: number;
    /** blob-through-app: average object size, to turn upload rps into bandwidth. */
    avgObjectMb?: number;
    /** storage-capacity: persistent storage the scenario needs, and which node kinds count toward it. */
    storage?: { kinds: NodeKind[]; requiredGb: number; what: string };
  };
  rules: RuleConfig[];
  /** One sentence per rule on why it matters in this scenario, appended to that rule's findings. */
  why?: Partial<Record<RuleId, string>>;
};

export type Finding = {
  rule: RuleId;
  severity: Severity;
  title: string;
  /** Plain sentence that includes the numbers that triggered it. */
  detail: string;
  /** The arithmetic, one step per line, when there is some. */
  math?: string[];
  nodeIds: string[];
  edgeIds: string[];
};

export type ScoreLine = { label: string; points: number };

export type GradeReport = {
  scenario: string;
  score: number;
  passed: boolean;
  /** How the score was reached: 100, then one line per deduction. */
  scoreMath: ScoreLine[];
  violations: Finding[];
  warnings: Finding[];
  tradeoffs: Finding[];
  /** Modelling assumptions the grader applied to this graph. */
  assumptions: string[];
  /** Computed load arriving at each node (rps), for display. */
  load: Record<string, number>;
};

export type Grader = (graph: DesignGraph, scenario: Scenario) => GradeReport;
