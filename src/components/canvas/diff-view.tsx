"use client";

import "@xyflow/react/dist/style.css";
import { Background, BackgroundVariant, ConnectionMode, Controls, type EdgeTypes, type NodeTypes, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { useMemo } from "react";
import { EDGE_SPECS, FIELDS, NODE_SPECS } from "@/lib/canvas/catalog";
import { type DesignGraph, type FieldChange, diffGraphs, diffIsEmpty } from "@/lib/canvas/graph";
import { DesignEdge, EdgeMarkers } from "./design-edge";
import { DesignNode } from "./design-node";
import type { DesignFlowEdge, DesignFlowNode } from "./flow";

const nodeTypes: NodeTypes = { design: DesignNode };
const edgeTypes: EdgeTypes = { design: DesignEdge };

const show = (v: unknown) => (v === undefined ? "—" : typeof v === "number" ? v.toLocaleString("en-US") : String(v));
const fieldName = (c: FieldChange) => (c.field === "label" ? "name" : c.field === "kind" ? "kind" : FIELDS[c.field].label);

/**
 * Version `to` drawn on the canvas, with nodes/edges marked against `from`.
 * Removed items are drawn as dashed ghosts where they used to be.
 */
export function DiffView({ from, to, fromVersion, toVersion }: { from: DesignGraph; to: DesignGraph; fromVersion: number; toVersion: number }) {
  const diff = useMemo(() => diffGraphs(from, to), [from, to]);

  const { nodes, edges } = useMemo(() => {
    const added = new Set(diff.addedNodes.map((n) => n.id));
    const changed = new Set(diff.changedNodes.map((c) => c.after.id));
    const moved = new Set(diff.movedNodes);
    const nodes: DesignFlowNode[] = [
      ...to.nodes.map((n) => ({
        id: n.id,
        type: "design" as const,
        position: n.position,
        data: { kind: n.kind, config: n.config, diff: added.has(n.id) ? ("added" as const) : changed.has(n.id) ? ("changed" as const) : moved.has(n.id) ? ("moved" as const) : undefined },
      })),
      ...diff.removedNodes.map((n) => ({ id: n.id, type: "design" as const, position: n.position, data: { kind: n.kind, config: n.config, diff: "removed" as const } })),
    ];
    const addedE = new Set(diff.addedEdges.map((e) => e.id));
    const changedE = new Set(diff.changedEdges.map((c) => c.after.id));
    const edges: DesignFlowEdge[] = [
      ...to.edges.map((e) => ({
        id: e.id,
        type: "design" as const,
        source: e.source,
        target: e.target,
        data: { kind: e.kind, label: e.label, diff: addedE.has(e.id) ? ("added" as const) : changedE.has(e.id) ? ("changed" as const) : undefined },
      })),
      // A removed edge whose endpoints were re-used keeps its id; give the ghost its own.
      ...diff.removedEdges.map((e) => ({ id: addedE.has(e.id) ? `${e.id}--was` : e.id, type: "design" as const, source: e.source, target: e.target, data: { kind: e.kind, label: e.label, diff: "removed" as const } })),
    ];
    return { nodes, edges };
  }, [diff, to]);

  const labelIn = (g: DesignGraph, id: string) => g.nodes.find((n) => n.id === id)?.config.label ?? id;
  const edgeText = (g: DesignGraph, e: { source: string; target: string; kind: keyof typeof EDGE_SPECS }) => `${labelIn(g, e.source)} → ${labelIn(g, e.target)} (${EDGE_SPECS[e.kind].title})`;
  const empty = diffIsEmpty(diff);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <EdgeMarkers />
      <div data-testid="diff-canvas" className="h-[62vh] min-h-[420px] border border-line bg-paper lg:h-[72vh]">
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectionMode={ConnectionMode.Loose} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} fitView fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }} minZoom={0.2}>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2e302a" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      <aside className="panel" data-testid="diff-summary">
        <div className="panel-head">
          <span className="label">
            v{fromVersion} → v{toVersion}
          </span>
        </div>
        <div className="grid gap-4 p-4 font-mono text-[0.76rem]">
          {empty && <p data-testid="diff-empty">No differences.</p>}
          <Section title="Components added" tone="text-ok" testid="diff-added-nodes" items={diff.addedNodes.map((n) => `${n.config.label} (${NODE_SPECS[n.kind].title})`)} />
          <Section title="Components removed" tone="text-bad" testid="diff-removed-nodes" items={diff.removedNodes.map((n) => `${n.config.label} (${NODE_SPECS[n.kind].title})`)} />
          {diff.changedNodes.length > 0 && (
            <section data-testid="diff-changed-nodes">
              <h3 className="label text-warn">Components changed · {diff.changedNodes.length}</h3>
              <ul className="mt-1.5 grid gap-2">
                {diff.changedNodes.map((c) => (
                  <li key={c.after.id}>
                    <p>{c.after.config.label}</p>
                    <ul className="mt-0.5 border-l border-warn pl-3 text-ink-2">
                      {c.changes.map((ch) => (
                        <li key={ch.field}>
                          {fieldName(ch)}: <span className="text-bad line-through">{show(ch.from)}</span> → <span className="text-ok">{show(ch.to)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Section title="Connections added" tone="text-ok" testid="diff-added-edges" items={diff.addedEdges.map((e) => edgeText(to, e))} />
          <Section title="Connections removed" tone="text-bad" testid="diff-removed-edges" items={diff.removedEdges.map((e) => edgeText(from, e))} />
          {diff.changedEdges.length > 0 && (
            <section data-testid="diff-changed-edges">
              <h3 className="label text-warn">Connections changed · {diff.changedEdges.length}</h3>
              <ul className="mt-1.5 grid gap-1">
                {diff.changedEdges.map((c) => (
                  <li key={c.after.id}>
                    {labelIn(to, c.after.source)} → {labelIn(to, c.after.target)}:{" "}
                    {c.changes.map((ch) => (
                      <span key={ch.field}>
                        {ch.field} <span className="text-bad line-through">{show(ch.field === "kind" ? EDGE_SPECS[ch.from as keyof typeof EDGE_SPECS].title : ch.from)}</span> →{" "}
                        <span className="text-ok">{show(ch.field === "kind" ? EDGE_SPECS[ch.to as keyof typeof EDGE_SPECS].title : ch.to)}</span>{" "}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {diff.movedNodes.length > 0 && <p className="text-ink-3">{diff.movedNodes.length} component(s) only moved on the canvas.</p>}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, tone, items, testid }: { title: string; tone: string; items: string[]; testid: string }) {
  if (items.length === 0) return null;
  return (
    <section data-testid={testid}>
      <h3 className={`label ${tone}`}>
        {title} · {items.length}
      </h3>
      <ul className="mt-1.5 grid gap-0.5">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
