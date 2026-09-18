"use client";

import { useEffect, useState } from "react";
import { EDGE_KINDS, EDGE_SPECS, type EdgeKind, FIELDS, type FieldKey, NODE_SPECS, type NodeConfig, fieldsFor } from "@/lib/canvas/catalog";
import { LIMITS } from "@/lib/canvas/graph";
import { EdgeSample } from "./design-edge";
import type { DesignFlowEdge, DesignFlowNode } from "./flow";
import { formatCount, nodeCapacity } from "./flow";
import { NodeIcon } from "./icons";

const fieldId = (key: string) => `inspector-${key}`;

/** A number box that only commits valid values; an invalid entry stays visible with its reason. */
function NumberField({ field, value, onCommit }: { field: Extract<(typeof FIELDS)[FieldKey], { type: "number" }>; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const n = Number(text);
  const problem =
    text.trim() === "" || !Number.isFinite(n)
      ? "Enter a number"
      : field.integer && !Number.isInteger(n)
        ? "Whole numbers only"
        : n < field.min || n > field.max
          ? `${field.min} to ${formatCount(field.max)}`
          : null;
  return (
    <label className="block">
      <span className="label text-[0.64rem]">
        {field.label} <span className="normal-case tracking-normal text-ink-3">({field.unit})</span>
      </span>
      <input
        id={fieldId(field.key)}
        data-testid={fieldId(field.key)}
        type="number"
        inputMode={field.integer ? "numeric" : "decimal"}
        min={field.min}
        max={field.max}
        step={field.integer ? 1 : "any"}
        value={text}
        aria-invalid={problem !== null}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(v) && (!field.integer || Number.isInteger(v)) && v >= field.min && v <= field.max) onCommit(v);
        }}
        onBlur={() => problem && setText(String(value))}
        className={`field mt-1 py-1.5 ${problem ? "border-bad" : ""}`}
      />
      {problem && <span className="mt-1 block font-mono text-[0.66rem] text-bad">{problem} · keeps {formatCount(value)}</span>}
    </label>
  );
}

export function NodeInspector({ node, onChange, onDelete }: { node: DesignFlowNode; onChange: (config: NodeConfig) => void; onDelete: () => void }) {
  const { kind, config } = node.data;
  const [label, setLabel] = useState(config.label);
  useEffect(() => setLabel(config.label), [config.label, node.id]);
  const set = <K extends keyof NodeConfig>(key: K, v: NodeConfig[K]) => onChange({ ...config, [key]: v });
  const capacity = nodeCapacity(config);

  return (
    <div data-testid="node-inspector" data-node={node.id}>
      <div className="flex items-center gap-2 text-accent">
        <NodeIcon kind={kind} />
        <span className="label text-accent">{NODE_SPECS[kind].title}</span>
      </div>
      <p className="mt-1 font-serif text-[0.95rem] text-ink-2 italic">{NODE_SPECS[kind].blurb}.</p>

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="label text-[0.64rem]">Name</span>
          <input
            data-testid="inspector-label"
            value={label}
            maxLength={LIMITS.label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (e.target.value.trim() !== "") set("label", e.target.value);
            }}
            onBlur={() => label.trim() === "" && setLabel(config.label)}
            className={`field mt-1 py-1.5 ${label.trim() === "" ? "border-bad" : ""}`}
          />
        </label>

        {fieldsFor(kind).map((key) => {
          const f = FIELDS[key];
          switch (f.type) {
            case "number":
              return <NumberField key={key} field={f} value={config[f.key] as number} onCommit={(v) => set(f.key, v)} />;
            case "select":
              return (
                <label key={key} className="block">
                  <span className="label text-[0.64rem]">{f.label}</span>
                  <select data-testid={fieldId(key)} value={config[key] as string} onChange={(e) => set(key, e.target.value as never)} className="field mt-1 py-1.5">
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              );
            case "boolean":
              return (
                <label key={key} className="flex items-center gap-2 font-mono text-[0.8rem]">
                  <input data-testid={fieldId(key)} type="checkbox" checked={config.persistence === true} onChange={(e) => set("persistence", e.target.checked)} className="h-4 w-4 accent-accent" />
                  {f.label}
                  <span className="text-ink-3">(survives restart)</span>
                </label>
              );
          }
        })}
      </div>

      {capacity !== null && (
        <p data-testid="inspector-capacity" className="mt-4 border border-rule bg-paper-2 px-3 py-2 font-mono text-[0.72rem]">
          Capacity: {config.replicas} × {formatCount(config.qpsIn!)} = <strong>{formatCount(capacity)} rps</strong>
        </p>
      )}

      <button type="button" data-testid="delete-node" onClick={onDelete} className="btn mt-5 w-full border-bad py-1.5 text-[0.78rem] text-bad">
        Delete component
      </button>
    </div>
  );
}

export function EdgeInspector({
  edge,
  sourceLabel,
  targetLabel,
  onChange,
  onReverse,
  onDelete,
  problem,
}: {
  edge: DesignFlowEdge;
  sourceLabel: string;
  targetLabel: string;
  onChange: (kind: EdgeKind, label: string) => void;
  onReverse: () => void;
  onDelete: () => void;
  problem: string | null;
}) {
  const kind = edge.data?.kind ?? "sync";
  const [label, setLabel] = useState(edge.data?.label ?? "");
  useEffect(() => setLabel(edge.data?.label ?? ""), [edge.data?.label, edge.id]);
  return (
    <div data-testid="edge-inspector" data-edge={edge.id}>
      <p className="label text-accent">Connection</p>
      <p className="mt-1 font-mono text-[0.8rem]">
        {sourceLabel} <span className="text-ink-3">→</span> {targetLabel}
      </p>
      <fieldset className="mt-4">
        <legend className="label text-[0.64rem]">Kind</legend>
        <div className="mt-1 grid gap-px border border-line bg-rule">
          {EDGE_KINDS.map((k) => (
            <label key={k} className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 font-mono text-[0.74rem] ${k === kind ? "bg-accent-soft" : "bg-paper hover:bg-paper-2"}`}>
              <input type="radio" name="edge-kind" data-testid={`edge-kind-${k}`} checked={k === kind} onChange={() => onChange(k, label)} className="accent-accent" />
              <EdgeSample kind={k} />
              {EDGE_SPECS[k].title}
            </label>
          ))}
        </div>
        <p className="mt-1.5 font-serif text-[0.9rem] text-ink-2 italic">{EDGE_SPECS[kind].blurb}.</p>
      </fieldset>
      {problem && (
        <p data-testid="edge-problem" className="mt-2 font-mono text-[0.7rem] text-bad">
          {problem}
        </p>
      )}
      <label className="mt-3 block">
        <span className="label text-[0.64rem]">Label (optional)</span>
        <input
          data-testid="edge-label"
          value={label}
          maxLength={LIMITS.label}
          placeholder="e.g. POST /orders"
          onChange={(e) => {
            setLabel(e.target.value);
            onChange(kind, e.target.value);
          }}
          className="field mt-1 py-1.5"
        />
      </label>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" data-testid="reverse-edge" onClick={onReverse} className="btn py-1.5 text-[0.78rem]">
          Reverse
        </button>
        <button type="button" data-testid="delete-edge" onClick={onDelete} className="btn border-bad py-1.5 text-[0.78rem] text-bad">
          Delete
        </button>
      </div>
    </div>
  );
}
