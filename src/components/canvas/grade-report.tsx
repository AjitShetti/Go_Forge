"use client";

import Link from "next/link";
import type { Finding, GradeReport, Scenario, Severity } from "@/lib/grader/types";

export type RecordState =
  | { kind: "recording" }
  | { kind: "recorded"; createdAt: string }
  | { kind: "not-recorded"; reason: string }
  | { kind: "error"; message: string };

const SECTION: Record<Severity, { title: string; empty: string; cls: string }> = {
  violation: { title: "Violations", empty: "None. Every hard constraint holds under this model.", cls: "text-bad border-bad" },
  warning: { title: "Warnings", empty: "None.", cls: "text-warn border-warn" },
  tradeoff: { title: "Tradeoffs you didn't declare", empty: "None found.", cls: "text-blue border-blue" },
};

export function GradeReportPanel({
  report,
  scenario,
  record,
  onFocus,
  onClose,
}: {
  report: GradeReport;
  scenario: Scenario;
  record: RecordState;
  onFocus: (f: Finding) => void;
  onClose: () => void;
}) {
  return (
    <section className="panel" data-testid="grade-report" data-score={report.score} data-passed={report.passed}>
      <div className="panel-head flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="label">Grade · {scenario.title}</span>
        <RecordChip record={record} />
        <button type="button" className="ml-auto font-mono text-[0.72rem] underline" onClick={onClose}>
          close
        </button>
      </div>
      <div className="grid gap-6 p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <p data-testid="grade-score" className={`font-pixel text-6xl font-bold ${report.passed ? "text-ok" : "text-bad"}`}>
            {report.score}
          </p>
          <p data-testid="grade-verdict" className={`mt-1 font-mono text-[0.74rem] tracking-[0.14em] uppercase ${report.passed ? "text-ok" : "text-bad"}`}>
            {report.passed ? "Passed · no violations" : `Failed · ${report.violations.length} violation${report.violations.length === 1 ? "" : "s"}`}
          </p>
          <table className="mt-4 w-full font-mono text-[0.72rem]" data-testid="score-math">
            <tbody>
              {report.scoreMath.map((l) => (
                <tr key={l.label} className="border-b border-rule">
                  <td className="py-1 pr-2 text-ink-2">{l.label}</td>
                  <td className="py-1 text-right">{l.points > 0 && l.label !== "Start" ? `+${l.points}` : l.points}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1 pr-2">Score</td>
                <td className="py-1 text-right">{report.score}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 font-mono text-[0.68rem] leading-relaxed text-ink-3">Deterministic rule engine: the same design always gets the same grade. Tradeoffs cost nothing; they are things to say out loud.</p>
          <Link href={`/scenarios/${scenario.slug}`} className="mt-3 inline-block font-mono text-[0.72rem] text-blue underline underline-offset-2" target="_blank">
            Scenario brief ↗
          </Link>
        </div>
        <div className="grid gap-5">
          {(["violation", "warning", "tradeoff"] as const).map((sev) => {
            const items = sev === "violation" ? report.violations : sev === "warning" ? report.warnings : report.tradeoffs;
            return (
              <div key={sev} data-testid={`grade-${sev}s`} data-count={items.length}>
                <p className={`label ${SECTION[sev].cls.split(" ")[0]}`}>
                  {SECTION[sev].title} ({items.length})
                </p>
                {items.length === 0 ? (
                  <p className="mt-1 font-serif text-[0.95rem] text-ink-3 italic">{SECTION[sev].empty}</p>
                ) : (
                  <ul className="mt-2 grid gap-2">
                    {items.map((f, i) => (
                      <li key={`${f.rule}-${i}`} data-testid="finding" data-rule={f.rule} className={`border-l-2 bg-paper px-3 py-2 ${SECTION[sev].cls.split(" ")[1]}`}>
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <span className="font-mono text-[0.78rem] font-bold">{f.title}</span>
                          <span className="font-mono text-[0.66rem] text-ink-3">{f.rule}</span>
                          {f.nodeIds.length > 0 && (
                            <button type="button" className="ml-auto font-mono text-[0.7rem] text-blue underline" onClick={() => onFocus(f)}>
                              show on canvas
                            </button>
                          )}
                        </div>
                        <p className="prose-serif mt-1 text-[0.95rem] text-ink-2">{f.detail}</p>
                        {f.math && (
                          <pre className="mt-1 overflow-x-auto font-mono text-[0.72rem] whitespace-pre-wrap text-ink">
                            {f.math.join("\n")}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {report.assumptions.length > 0 && (
            <details data-testid="grade-assumptions">
              <summary className="label cursor-pointer">Assumptions the grader made ({report.assumptions.length})</summary>
              <ul className="mt-2 list-disc pl-5 font-mono text-[0.72rem] text-ink-2">
                {report.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

function RecordChip({ record }: { record: RecordState }) {
  const base = "border px-2 py-0.5 font-mono text-[0.68rem] tracking-[0.1em] uppercase";
  switch (record.kind) {
    case "recording":
      return <span data-testid="grade-record" data-kind="recording" className={`${base} border-ink-3 text-ink-3`}>Recording…</span>;
    case "recorded":
      return <span data-testid="grade-record" data-kind="recorded" className={`${base} border-ok text-ok`}>Recorded · {new Date(record.createdAt).toLocaleString()}</span>;
    case "not-recorded":
      return <span data-testid="grade-record" data-kind="not-recorded" title={record.reason} className={`${base} border-warn text-warn`}>Not recorded · {record.reason}</span>;
    case "error":
      return <span data-testid="grade-record" data-kind="error" className={`${base} border-bad text-bad`}>{record.message}</span>;
  }
}
