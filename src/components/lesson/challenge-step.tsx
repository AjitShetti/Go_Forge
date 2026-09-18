"use client";

import { useState } from "react";
import { CodeEditor } from "@/components/code-editor";
import { Markdown } from "@/components/markdown";
import { buildHarness, HARNESS_FILE, LEARNER_FILE, parseTestOutput, TESTS_FILE, type TestReport } from "@/lib/content/harness";
import { getExecutor } from "@/lib/engine/wasm-executor";
import type { ExecResult } from "@/lib/engine/types";
import { HINT_THRESHOLDS, view } from "@/lib/lesson/machine";
import { StepSection } from "./chrome";
import type { StepProps } from "./types";

export function ChallengeStep({ bundle, state, dispatch, engineReady }: StepProps & { engineReady: boolean }) {
  const fm = bundle.lesson.frontmatter;
  const v = view(state);
  const active = state.step === "challenge";
  const [code, setCode] = useState(bundle.files.challengeStarter);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<{ exec: ExecResult; report: TestReport } | null>(null);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  async function runTests() {
    setRunning(true);
    const exec = await getExecutor().run(
      [
        { name: LEARNER_FILE, content: code },
        { name: TESTS_FILE, content: bundle.files.challengeTests },
        { name: HARNESS_FILE, content: buildHarness([bundle.files.challengeTests]) },
      ],
      { timeoutMs: 10000, lang: fm.lang },
    );
    const report = parseTestOutput(exec.stdout, exec.exitCode);
    setLast({ exec, report });
    setRunning(false);
    // The engine itself failed (not the learner's code): not an attempt, so no hint unlocks and nothing is recorded.
    if (exec.status === "engine_error") return;
    const failedCases = exec.status === "compile_error" ? ["(compile error)"] : report.incomplete && report.failedCases.length === 0 ? [`(${exec.status})`] : report.failedCases;
    dispatch(
      { type: "CHALLENGE_RESULT", passed: report.passed, failedCases, at: Date.now() },
      { code, stdout: exec.stdout, stderr: exec.stderr, exitCode: exec.exitCode, status: exec.status, ms: exec.totalMs, failedCases },
    );
  }

  return (
    <StepSection id="challenge" n={5} title="Challenge" done={state.passed}>
      {bundle.lesson.sections.Challenge && <Markdown source={bundle.lesson.sections.Challenge} />}

      <div className="mt-5">
        <CodeEditor id="challenge" value={code} onChange={setCode} height={300} readOnly={!active} />
      </div>

      {active && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-solid" data-testid="run-tests" disabled={!engineReady || running} onClick={runTests}>
            {running ? "Running tests…" : "Run hidden tests"}
          </button>
          <span className="label" data-testid="attempts">
            {state.attempts} attempts · {state.failedAttempts} failed
          </span>
        </div>
      )}

      {last && <TestResults exec={last.exec} report={last.report} />}

      {state.passed && (
        <p className="mt-5 border border-ok px-4 py-3 font-mono text-sm text-ok" data-testid="challenge-passed">
          All tests pass.
        </p>
      )}

      {/* Hints: visibly locked, visibly costed. */}
      <div className="panel mt-6" data-testid="hints">
        <div className="panel-head">
          <span className="label">Hints · using one is recorded with your attempt</span>
          <span className="label">{state.hintsRevealed}/2 used</span>
        </div>
        <ol className="divide-y divide-rule">
          {HINT_THRESHOLDS.map((threshold, i) => {
            const revealed = i < state.hintsRevealed;
            const isNext = i === state.hintsRevealed;
            return (
              <li key={i} className="px-4 py-3" data-testid={`hint-${i + 1}`} data-state={revealed ? "revealed" : isNext && v.canRevealHint ? "available" : "locked"}>
                {revealed ? (
                  <p className="prose-serif">
                    <span className="label mr-2">Hint {i + 1}</span>
                    {bundle.hints[i]}
                  </p>
                ) : isNext && v.canRevealHint ? (
                  <button className="btn btn-primary" data-testid={`reveal-hint-${i + 1}`} onClick={() => dispatch({ type: "REVEAL_HINT", at: Date.now() })}>
                    Reveal hint {i + 1}
                  </button>
                ) : state.passed || state.gaveUp ? (
                  <p className="font-mono text-sm text-ink-3">Hint {i + 1} · not used</p>
                ) : (
                  <p className="font-mono text-sm text-ink-3">
                    Hint {i + 1} · locked · unlocks after {threshold} failed attempts
                    {isNext && v.failuresUntilNextHint !== null ? ` (${v.failuresUntilNextHint} more)` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {v.canGiveUp &&
          (confirmGiveUp ? (
            <>
              <span className="font-mono text-sm text-bad">This shows the solution and marks the lesson for review, not complete.</span>
              <button className="btn border-bad text-bad" data-testid="confirm-give-up" onClick={() => dispatch({ type: "GIVE_UP", at: Date.now() })}>
                Yes, give up
              </button>
              <button className="btn" onClick={() => setConfirmGiveUp(false)}>
                Keep trying
              </button>
            </>
          ) : (
            <button className="btn" data-testid="give-up" onClick={() => setConfirmGiveUp(true)}>
              I give up
            </button>
          ))}
        {v.canRevealSolution && (
          <button className="btn" data-testid="reveal-solution" onClick={() => dispatch({ type: "REVEAL_SOLUTION", at: Date.now() })}>
            Show reference solution
          </button>
        )}
        {state.gaveUp && <span className="border border-warn px-2 py-1 font-mono text-[0.7rem] text-warn">Marked for review</span>}
      </div>

      {v.showSolution && (
        <div className="mt-5" data-testid="solution">
          <p className="label mb-2">Reference solution</p>
          <CodeEditor id="solution" value={bundle.files.challengeSolution} readOnly height={200} />
        </div>
      )}

      {active && v.canContinue && (
        <button className="btn btn-primary mt-8" data-testid="continue" onClick={() => dispatch({ type: "CONTINUE", at: Date.now() })}>
          Stretch →
        </button>
      )}
    </StepSection>
  );
}

function TestResults({ exec, report }: { exec: ExecResult; report: TestReport }) {
  if (exec.status === "engine_error") {
    return (
      <p className="mt-4 border border-warn px-3 py-2 font-mono text-sm text-warn" data-testid="test-results" data-passed="false" data-engine-error="true">
        The engine could not run the tests ({exec.engineError ?? "unknown error"}). This did not count as an attempt. Try again.
      </p>
    );
  }
  if (exec.status === "compile_error") {
    return (
      <div className="panel mt-4 border-bad" data-testid="test-results" data-passed="false">
        <div className="panel-head">
          <span className="label text-bad">Does not compile</span>
        </div>
        <pre className="code-block p-4 text-bad">{exec.stderr}</pre>
      </div>
    );
  }
  return (
    <div className={`panel mt-4 ${report.passed ? "border-ok" : "border-bad"}`} data-testid="test-results" data-passed={report.passed}>
      <div className="panel-head">
        <span className={`label ${report.passed ? "text-ok" : "text-bad"}`}>
          {report.cases.length - report.failedCases.length}/{report.cases.length} cases pass{report.incomplete ? ` · run did not finish (${exec.status})` : ""}
        </span>
        <span className="label">{exec.totalMs} ms</span>
      </div>
      <ul className="divide-y divide-rule">
        {report.cases.map((c) => (
          <li key={c.name} className="px-4 py-2 font-mono text-sm" data-testid="test-case" data-status={c.status}>
            <span className={c.status === "PASS" ? "text-ok" : "text-bad"}>{c.status}</span> {c.name}
            {c.status === "FAIL" && c.output.length > 0 && <pre className="code-block mt-1 pl-10 text-ink-2">{c.output.join("\n")}</pre>}
          </li>
        ))}
      </ul>
      {exec.status === "timeout" && (
        <p className="border-t border-rule px-4 py-3 font-mono text-sm text-bad" data-testid="timeout-note">
          Stopped after 10 seconds. Look for a loop that never ends or a solution that is far too slow.
        </p>
      )}
      {report.incomplete && exec.stderr && <pre className="code-block border-t border-rule p-4 text-bad">{exec.stderr}</pre>}
    </div>
  );
}
