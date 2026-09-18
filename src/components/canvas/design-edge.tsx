"use client";

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, type InternalNode, useInternalNode, useStore } from "@xyflow/react";
import { memo } from "react";
import { EDGE_KINDS, EDGE_SPECS } from "@/lib/canvas/catalog";
import { EDGE_LOOK } from "./edge-style";
import type { DesignFlowEdge } from "./flow";

type Pt = { x: number; y: number };

function box(n: InternalNode) {
  const { x, y } = n.internals.positionAbsolute;
  const w = n.measured.width ?? 188;
  const h = n.measured.height ?? 60;
  return { cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2 };
}

/** Where the line from the box centre towards `to` crosses the box border (plus a small gap). */
function borderPoint(b: ReturnType<typeof box>, to: Pt, gap: number): Pt {
  const dx = to.x - b.cx;
  const dy = to.y - b.cy;
  if (dx === 0 && dy === 0) return { x: b.cx, y: b.cy };
  const t = Math.min(Math.abs(dx) > 0 ? (b.hw + gap) / Math.abs(dx) : Infinity, Math.abs(dy) > 0 ? (b.hh + gap) / Math.abs(dy) : Infinity);
  return { x: b.cx + dx * t, y: b.cy + dy * t };
}

function DesignEdgeView({ id, source, target, data, selected }: EdgeProps<DesignFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  // Edges between the same two nodes (either direction) are fanned out side by side.
  const siblings = useStore((st) =>
    st.edges
      .filter((e) => (e.source === source && e.target === target) || (e.source === target && e.target === source))
      .map((e) => e.id)
      .sort()
      .join(","),
  );
  if (!s || !t) return null;

  const kind = data?.kind ?? "sync";
  const look = EDGE_LOOK[kind];
  const sb = box(s);
  const tb = box(t);

  const ids = siblings.split(",");
  const index = ids.indexOf(id);
  // Perpendicular offset, measured in a direction that doesn't depend on which end is the source.
  const [a, b] = source < target ? [sb, tb] : [tb, sb];
  const len = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1;
  const nx = -(b.cy - a.cy) / len;
  const ny = (b.cx - a.cx) / len;
  const off = (index - (ids.length - 1) / 2) * 16;

  const sc = { x: sb.cx + nx * off, y: sb.cy + ny * off };
  const tc = { x: tb.cx + nx * off, y: tb.cy + ny * off };
  const p1 = borderPoint({ ...sb, cx: sc.x, cy: sc.y }, tc, 2);
  const p2 = borderPoint({ ...tb, cx: tc.x, cy: tc.y }, sc, 6);
  const path = `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  const diffColor = data?.diff === "added" ? "#5fcb8a" : data?.diff === "removed" ? "#ff6a55" : data?.diff === "changed" ? "#e6b450" : null;
  const color = selected ? "#4fcbeb" : look.color;
  const marker = `url(#gf-arrow-${kind}${selected ? "-sel" : ""})`;

  return (
    <>
      {diffColor && <path d={path} fill="none" stroke={diffColor} strokeOpacity={0.22} strokeWidth={14} />}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={marker}
        interactionWidth={18}
        style={{ stroke: color, strokeWidth: look.width + (selected ? 0.8 : 0), strokeDasharray: data?.diff === "removed" ? "3 4" : look.dash }}
      />
      {look.rail && <path d={path} fill="none" stroke="#121310" strokeWidth={1.8} pointerEvents="none" />}
      <EdgeLabelRenderer>
        <div
          data-testid={`edge-${id}`}
          data-kind={kind}
          data-diff={data?.diff ?? ""}
          className="nodrag nopan pointer-events-none absolute border bg-paper px-1 font-mono text-[0.58rem] leading-[1.35]"
          style={{ transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`, borderColor: diffColor ?? color, color: diffColor ?? color }}
        >
          {EDGE_SPECS[kind].short}
          {data?.label ? <span className="normal-case tracking-normal"> · {data.label}</span> : null}
          {data?.diff ? <span> · {data.diff}</span> : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const DesignEdge = memo(DesignEdgeView);

/** Arrowhead markers, rendered once per canvas; edges refer to them by id. */
export function EdgeMarkers() {
  return (
    <svg aria-hidden style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        {EDGE_KINDS.flatMap((k) =>
          [false, true].map((sel) => {
            const look = EDGE_LOOK[k];
            const c = sel ? "#4fcbeb" : look.color;
            return (
              <marker key={`${k}${sel}`} id={`gf-arrow-${k}${sel ? "-sel" : ""}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                {look.arrow === "closed" ? <path d="M0,0 L10,5 L0,10 z" fill={c} /> : <path d="M1,1 L9,5 L1,9" fill="none" stroke={c} strokeWidth={1.6} />}
              </marker>
            );
          }),
        )}
      </defs>
    </svg>
  );
}

/** A short sample of an edge kind's line, for the legend and inspector. */
export function EdgeSample({ kind, width = 44 }: { kind: (typeof EDGE_KINDS)[number]; width?: number }) {
  const look = EDGE_LOOK[kind];
  const d = `M 2,7 L ${width - 8},7`;
  return (
    <svg width={width} height={14} aria-hidden className="shrink-0">
      <path d={d} stroke={look.color} strokeWidth={look.width} strokeDasharray={look.dash} fill="none" markerEnd={`url(#gf-arrow-${kind})`} />
      {look.rail && <path d={d} stroke="#121310" strokeWidth={1.8} fill="none" />}
    </svg>
  );
}
