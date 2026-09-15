// Conversion between the stored DesignGraph and React Flow's node/edge state.
import type { Edge, Node } from "@xyflow/react";
import { type EdgeKind, NODE_SPECS, type NodeConfig, type NodeKind } from "@/lib/canvas/catalog";
import { type DesignGraph, GRAPH_SCHEMA } from "@/lib/canvas/graph";

export type DiffMark = "added" | "removed" | "changed" | "moved";

export type DesignNodeData = { kind: NodeKind; config: NodeConfig; diff?: DiffMark };
export type DesignFlowNode = Node<DesignNodeData, "design">;

export type DesignEdgeData = { kind: EdgeKind; label?: string; diff?: DiffMark };
export type DesignFlowEdge = Edge<DesignEdgeData, "design">;

export function toFlowNodes(g: DesignGraph): DesignFlowNode[] {
  return g.nodes.map((n) => ({ id: n.id, type: "design", position: { ...n.position }, data: { kind: n.kind, config: { ...n.config } } }));
}

export function toFlowEdges(g: DesignGraph): DesignFlowEdge[] {
  return g.edges.map((e) => ({ id: e.id, type: "design", source: e.source, target: e.target, data: e.label ? { kind: e.kind, label: e.label } : { kind: e.kind } }));
}

export function toGraph(nodes: DesignFlowNode[], edges: DesignFlowEdge[]): DesignGraph {
  return {
    schema: GRAPH_SCHEMA,
    nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, position: { x: n.position.x, y: n.position.y }, config: n.data.config })),
    edges: edges.map((e) => {
      const kind = e.data?.kind ?? "sync";
      return e.data?.label ? { id: e.id, source: e.source, target: e.target, kind, label: e.data.label } : { id: e.id, source: e.source, target: e.target, kind };
    }),
  };
}

export function newId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 10) : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${rand}`;
}

const fmt = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${+(n / 1000).toFixed(1)}k` : n.toLocaleString("en-US"));

/** Short facts under a node's title: "3× · 2k rps each · us-east-1". */
export function nodeSummary(kind: NodeKind, c: NodeConfig): string[] {
  const out: string[] = [];
  if (c.role) out.push(c.role.toUpperCase());
  if (c.replicas !== undefined) out.push(`${c.replicas}×`);
  if (c.qpsIn !== undefined) out.push(c.replicas !== undefined ? `${fmt(c.qpsIn)} rps each` : `${fmt(c.qpsIn)} rps`);
  if (c.qpsIn === undefined && c.qpsOut !== undefined) out.push(`${fmt(c.qpsOut)} rps out`);
  if (c.storageGb !== undefined && NODE_SPECS[kind].stateful) out.push(c.storageGb >= 1000 ? `${+(c.storageGb / 1000).toFixed(1)} TB` : `${c.storageGb} GB`);
  if (c.region) out.push(c.region);
  return out;
}

/** Total capacity when the node has both replicas and per-replica QPS. */
export function nodeCapacity(c: NodeConfig): number | null {
  return c.replicas !== undefined && c.qpsIn !== undefined ? c.replicas * c.qpsIn : null;
}

export { fmt as formatCount };
