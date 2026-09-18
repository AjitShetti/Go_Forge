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
    <ol className="mt-10 grid grid-cols-3 border-t border-l border-rule sm:grid-cols-6" data-testid="stepper">
      {STEPS.filter((s) => s !== "complete").map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={s}
            data-step={s}
            data-status={done ? "done" : active ? "active" : "locked"}
            className={`relative border-r border-b border-rule px-3 py-3 text-[0.88rem] font-semibold ${active ? "bg-accent text-on-accent" : done ? "bg-paper text-ink" : "text-ink-3"}`}
          >
            <span className={`block font-mono text-[0.72rem] font-normal ${active ? "text-on-accent/70" : done ? "text-accent" : "text-ink-3"}`}>0{i + 1}{done && " ✓"}</span>
            {LABELS[s]}
          </li>
        );
      })}
    </ol>
  );
}

export function SaveBadge({ status }: { status: SaveStatus }) {
  const base = "border px-2 py-1 font-mono text-[0.7rem]";
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
    <section id={id} data-testid={`step-${id}`} className="scroll-mt-24">
      <div className="mb-6 flex items-baseline gap-4 border-b border-line pb-3">
        <span className="font-mono text-[0.9rem] text-accent">0{n}</span>
        <h2 className="font-display text-[1.6rem] leading-none font-extrabold">{title}</h2>
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
    <pre className="code-block overflow-x-auto bg-paper py-3">
      {lines.map((l, i) => (
        <div key={i} className={`flex ${highlight.includes(i + 1) ? "bg-accent-soft/60" : ""}`}>
          <span className="w-10 shrink-0 pr-3 text-right text-ink-3 select-none">{i + 1}</span>
          <span className="pr-4">{l || " "}</span>
        </div>
      ))}
    </pre>
  );
}
