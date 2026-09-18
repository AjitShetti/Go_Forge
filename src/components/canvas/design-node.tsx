"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import { NODE_SPECS } from "@/lib/canvas/catalog";
import type { DesignFlowNode } from "./flow";
import { nodeSummary } from "./flow";
import { NodeIcon } from "./icons";

const DIFF_STYLE = {
  added: { box: "border-ok", badge: "bg-ok text-paper", text: "Added" },
  removed: { box: "border-bad border-dashed opacity-60", badge: "bg-bad text-paper", text: "Removed" },
  changed: { box: "border-warn", badge: "bg-warn text-paper", text: "Changed" },
  moved: { box: "border-ink-3", badge: "bg-ink-3 text-paper", text: "Moved" },
} as const;

// Four handles, all "source": the canvas runs in loose connection mode, so a
// drag can start and end on any side. Edges are drawn centre-to-centre
// (design-edge.tsx), so which handle was used is never stored.
const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

function DesignNodeView({ id, data, selected }: NodeProps<DesignFlowNode>) {
  const spec = NODE_SPECS[data.kind];
  const diff = data.diff ? DIFF_STYLE[data.diff] : null;
  const summary = nodeSummary(data.kind, data.config);
  return (
    <div
      data-testid={`node-${id}`}
      data-kind={data.kind}
      data-diff={data.diff ?? ""}
      className={`relative w-[188px] border bg-paper px-3 py-2.5 ${diff ? diff.box : selected ? "border-accent" : "border-line"} ${selected ? "outline-2 outline-offset-2 outline-accent" : ""}`}
    >
      {diff && <span className={`absolute -top-2.5 right-2 px-1.5 font-mono text-[0.6rem] ${diff.badge}`}>{diff.text}</span>}
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-accent">
          <NodeIcon kind={data.kind} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-[0.82rem] leading-tight font-medium" title={data.config.label}>
            {data.config.label}
          </p>
          <p className="mt-0.5 font-mono text-[0.6rem] text-ink-3">{spec.title}</p>
        </div>
      </div>
      {summary.length > 0 && <p className="mt-2 border-t border-rule pt-1.5 font-mono text-[0.66rem] leading-snug text-ink-2">{summary.join(" · ")}</p>}
      {SIDES.map((side) => (
        <Handle key={side} id={side} type="source" position={side} className="gf-handle" />
      ))}
    </div>
  );
}

export const DesignNode = memo(DesignNodeView);
