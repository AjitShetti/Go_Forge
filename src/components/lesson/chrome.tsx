"use client";

import type { ReactNode } from "react";
import { STEPS, type LessonState } from "@/lib/lesson/machine";
import type { SaveStatus } from "@/lib/lesson/recorder";

const LABELS: Record<string, string> = {
  provoke: "Provoke",
  collide: "Collide",
  decode: "Decode",
  rebuild: "Rebuild",
  challenge: "Challenge",
  stretch: "Stretch",
};

export function Stepper({ state }: { state: LessonState }) {
  const current = STEPS.indexOf(state.step);
  return (
    <ol className="mt-8 grid grid-cols-3 gap-px border border-ink bg-ink sm:grid-cols-6" data-testid="stepper">
      {STEPS.filter((s) => s !== "complete").map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={s}
            data-step={s}
            data-status={done ? "done" : active ? "active" : "locked"}
            className={`px-3 py-2.5 font-mono text-[0.72rem] tracking-[0.12em] uppercase ${active ? "bg-blue text-paper" : done ? "bg-paper text-ink" : "bg-paper-2 text-ink-3"}`}
          >
            <span className={active ? "text-paper/70" : "text-ink-3"}>0{i + 1}</span> {LABELS[s]} {done && "✓"}
          </li>
        );
      })}
    </ol>
  );
}

export function SaveBadge({ status }: { status: SaveStatus }) {
  const base = "border px-2 py-1 font-mono text-[0.7rem] tracking-[0.14em] uppercase";
  switch (status.kind) {
    case "not-saved":
      return (
        <span data-testid="save-status" data-kind="not-saved" title={status.reason} className={`${base} border-bad text-bad`}>
          Not saved · {status.reason}
        </span>
      );
    case "saving":
      return (
        <span data-testid="save-status" data-kind="saving" className={`${base} border-rule text-ink-3`}>
          Saving…
        </span>
      );
    case "saved":
      return (
        <span data-testid="save-status" data-kind="saved" className={`${base} border-ok text-ok`}>
          Saved
        </span>
      );
    case "error":
      return (
        <span data-testid="save-status" data-kind="error" title={status.message} className={`${base} border-bad text-bad`}>
          Save failed · {status.message}
        </span>
      );
  }
}

export function StepSection({ id, n, title, children, done }: { id: string; n: number; title: string; children: ReactNode; done?: boolean }) {
  return (
    <section id={id} data-testid={`step-${id}`} className="scroll-mt-8">
      <div className="mb-5 flex items-baseline gap-4 border-b border-ink pb-2">
        <span className="font-pixel text-2xl font-bold text-blue">0{n}</span>
        <h2 className="font-mono text-sm tracking-[0.16em] uppercase">{title}</h2>
        {done && <span className="label ml-auto text-ok">done</span>}
      </div>
      {children}
    </section>
  );
}

export function OutputPanel({ label, stdout, stderr, testId, tone }: { label: string; stdout: string; stderr?: string; testId?: string; tone?: "ok" | "bad" }) {
  return (
    <div className={`panel ${tone === "ok" ? "border-ok" : tone === "bad" ? "border-bad" : ""}`}>
      <div className="panel-head">
        <span className="label">{label}</span>
      </div>
      <pre data-testid={testId} className="code-block min-h-14 overflow-x-auto p-4">
        {stdout}
        {stderr && <span className="text-bad">{stderr}</span>}
      </pre>
    </div>
  );
}

export function CodeView({ code, highlight = [] }: { code: string; highlight?: number[] }) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <pre className="code-block overflow-x-auto bg-[#fdfcf8] py-3">
      {lines.map((l, i) => (
        <div key={i} className={`flex ${highlight.includes(i + 1) ? "bg-blue-soft/60" : ""}`}>
          <span className="w-10 shrink-0 pr-3 text-right text-ink-3 select-none">{i + 1}</span>
          <span className="pr-4">{l || " "}</span>
        </div>
      ))}
    </pre>
  );
}
