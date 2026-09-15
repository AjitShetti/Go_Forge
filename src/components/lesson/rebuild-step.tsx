"use client";

import { useState } from "react";
import { CodeEditor } from "@/components/code-editor";
import { Markdown } from "@/components/markdown";
import { changedLockedLines, normalizeForCompare } from "@/lib/content/lesson";
import { getExecutor } from "@/lib/engine/wasm-executor";
import type { ExecResult } from "@/lib/engine/types";
import { OutputPanel, StepSection } from "./chrome";
import type { StepProps } from "./types";

export function RebuildStep({ bundle, state, dispatch, engineReady }: StepProps & { engineReady: boolean }) {
  const fm = bundle.lesson.frontmatter;
  const locked = bundle.expected.rebuild.lockedLines;
  const [code, setCode] = useState(bundle.files.rebuild);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<(ExecResult & { goalMet: boolean }) | null>(null);
  const [lockViolation, setLockViolation] = useState<number[]>([]);
  const active = state.step === "rebuild";

  async function run() {
    const changed = changedLockedLines(bundle.files.rebuild, code, locked);
    setLockViolation(changed);
    if (changed.length > 0) return;
    setRunning(true);
    const r = await getExecutor().run([{ name: "main.go", content: code }], { timeoutMs: 5000, lang: fm.lang });
    const goalMet = r.exitCode === 0 && r.status === "ok" && normalizeForCompare(r.stdout) === normalizeForCompare(bundle.expected.rebuild.expectedStdout);
    setResult({ ...r, goalMet });
    setRunning(false);
    dispatch({ type: "REBUILD_RUN", goalMet, at: Date.now() }, { code, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, status: r.status, ms: r.totalMs });
  }

  return (
    <StepSection id="rebuild" n={4} title="Rebuild" done={!active}>
      {bundle.lesson.sections.Rebuild && <Markdown source={bundle.lesson.sections.Rebuild} />}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-blue bg-blue-soft/40 px-4 py-3">
        <p className="font-mono text-sm">
          <span className="label mr-2 text-blue">Goal</span>
          {fm.rebuild.goal}
        </p>
        <span data-testid="goal-status" data-met={state.rebuildGoalMet} className={`label ${state.rebuildGoalMet ? "text-ok" : "text-ink-3"}`}>
          {state.rebuildGoalMet ? "goal met ✓" : "not met yet"}
        </span>
      </div>

      <div className="mt-4">
        <CodeEditor id="rebuild" value={code} onChange={setCode} lockedLines={locked} height={260} readOnly={!active} />
      </div>

      {active && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-solid" data-testid="run-rebuild" disabled={!engineReady || running} onClick={run}>
            {running ? "Running…" : "Run"}
          </button>
          <button className="btn" onClick={() => setCode(bundle.files.rebuild)}>
            Reset code
          </button>
          <span className="label">{state.rebuildRuns} runs · unlimited</span>
        </div>
      )}
      {lockViolation.length > 0 && (
        <p className="mt-4 border border-bad px-3 py-2 font-mono text-sm text-bad" data-testid="lock-violation">
          Line{lockViolation.length > 1 ? "s" : ""} {lockViolation.join(", ")} must stay exactly as written. Not run.
        </p>
      )}
      {result && (
        <div className="mt-4">
          <OutputPanel
            label={`Output · ${result.status}${result.exitCode > 0 ? ` · exit ${result.exitCode}` : ""}`}
            stdout={result.stdout}
            stderr={result.stderr}
            testId="rebuild-output"
            tone={result.goalMet ? "ok" : undefined}
          />
        </div>
      )}
      {active && (
        <button className="btn btn-primary mt-8" data-testid="continue" onClick={() => dispatch({ type: "CONTINUE", at: Date.now() })}>
          On to the challenge →
        </button>
      )}
    </StepSection>
  );
}
