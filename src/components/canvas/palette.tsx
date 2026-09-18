"use client";

import { NODE_KINDS, NODE_SPECS, type NodeKind } from "@/lib/canvas/catalog";
import { NodeIcon } from "./icons";

export const DRAG_MIME = "application/x-goforge-node";

/** Drag a component onto the canvas, or press it to drop one in the middle of the view. */
export function Palette({ onAdd, disabled }: { onAdd: (kind: NodeKind) => void; disabled?: boolean }) {
  return (
    <div className="panel" data-testid="palette">
      <div className="panel-head">
        <span className="label">Components</span>
        <span className="font-mono text-[0.66rem] text-ink-3">{NODE_KINDS.length}</span>
      </div>
      <ul className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 lg:grid-cols-1">
        {NODE_KINDS.map((kind) => (
          <li key={kind} className="bg-paper">
            <button
              type="button"
              draggable={!disabled}
              disabled={disabled}
              data-testid={`palette-${kind}`}
              title={`${NODE_SPECS[kind].blurb}. Drag onto the canvas, or click to add.`}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, kind);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onAdd(kind)}
              className="flex w-full cursor-grab items-center gap-2 px-3 py-2 text-left font-mono text-[0.74rem] hover:bg-accent-soft active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-accent">
                <NodeIcon kind={kind} className="h-4 w-4" />
              </span>
              <span className="truncate">{NODE_SPECS[kind].title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
