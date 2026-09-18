"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { normalizeForCompare, observedOutput, predictionMatches } from "@/lib/content/lesson";
import { getExecutor } from "@/lib/engine/wasm-executor";
import { view } from "@/lib/lesson/machine";
import { CodeView, OutputPanel, StepSection } from "./chrome";
import type { StepProps } from "./types";

export function ProvokeStep({ bundle, state, dispatch, engineReady }: StepProps & { engineReady: boolean }) {
  const fm = bundle.lesson.frontmatter;
  const trap = fm.trap;
  const v = view(state);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [runError, setRunError] = useState<string | null>(null);

  const draft = trap.kind === "choice" ? (choice === null ? "" : trap.choices![choice]) : text;
  const verifiedTrap = bundle.expected.blocks.trap?.real;

  async function runTrap() {
    setRunError(null);
    if (!dispatch({ type: "TRAP_RUN_STARTED", at: Date.now() })) return;
    const r = await getExecutor().run([{ name: "main.go", content: bundle.files.trap }], { timeoutMs: 10000, lang: fm.lang });
    if (r.status === "timeout" || r.status === "engine_error" || r.status === "output_limit") {
      setRunError(`The engine could not run the program (${r.status}${r.engineError ? `: ${r.engineError}` : ""}). Try again.`);
      dispatch({ type: "TRAP_RUN_FAILED", at: Date.now() });
      return;
    }
    const observed = observedOutput(r);
    dispatch(
      { type: "TRAP_RESULT", observed, correct: predictionMatches(trap, state.prediction ?? "", observed), at: Date.now() },
      { code: bundle.files.trap, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, status: r.status, ms: r.totalMs },
    );
  }

  const engineMatchesVerified = !state.trap || !verifiedTrap || normalizeForCompare(state.trap.observed) === observedOutput(verifiedTrap);

  return (
    <>
      <StepSection id="provoke" n={1} title="Provoke" done={v.showCollide}>
        {bundle.lesson.sections.Provoke && <Markdown source={bundle.lesson.sections.Provoke} />}
        <div className="panel mt-6">
          <div className="panel-head">
            <span className="label">main.go</span>
            <span className="label">{bundle.expected.goVersion}</span>
          </div>
          <CodeView code={bundle.files.trap} />
        </div>

        <fieldset className="mt-6" disabled={!v.canPredict}>
          <legend className="prose-serif text-xl">{trap.question}</legend>
          {trap.kind === "choice" ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup">
              {trap.choices!.map((c, i) => {
                const selected = state.prediction !== null ? state.prediction === c : choice === i;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`choice-${i}`}
                    onClick={() => setChoice(i)}
                    className={`border px-4 py-3 text-left font-mono text-sm transition-colors ${selected ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper hover:bg-paper-2"} disabled:cursor-not-allowed`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              data-testid="prediction-text"
              className="field code-block mt-4 h-28"
              placeholder="Type the exact output you expect"
              value={state.prediction ?? text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {v.canPredict && (
            <button className="btn btn-primary" data-testid="lock-prediction" disabled={draft.trim() === ""} onClick={() => dispatch({ type: "PREDICT", text: draft, at: Date.now() })}>
              Lock in prediction
            </button>
          )}
          {!v.showCollide && (
            <button className="btn btn-solid" data-testid="run-trap" disabled={!v.canRunTrap || !engineReady} onClick={runTrap}>
              {state.trapRunning ? "Running…" : !v.canRunTrap ? "Run · predict first" : !engineReady ? "Run · engine loading" : "Run"}
            </button>
          )}
          {state.prediction !== null && !v.showCollide && <span className="label">Prediction locked. It can't be changed.</span>}
        </div>
        {runError && <p className="mt-4 font-mono text-sm text-bad">{runError}</p>}
      </StepSection>

      {v.showCollide && state.trap && (
        <StepSection id="collide" n={2} title="Collide" done={v.showDecode}>
          <div className={`mb-5 border px-4 py-3 font-mono text-sm ${state.trap.correct ? "border-ok text-ok" : "border-bad text-bad"}`} data-testid="verdict" data-correct={state.trap.correct}>
            {state.trap.correct ? "Match: your prediction was right." : "Mismatch: that is not what Go printed."}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <OutputPanel label="Your prediction" stdout={state.prediction ?? ""} testId="collide-prediction" />
            <OutputPanel label="What Go printed" stdout={state.trap.observed} testId="collide-actual" tone={state.trap.correct ? "ok" : "bad"} />
          </div>
          {!engineMatchesVerified && (
            <p className="mt-4 border border-warn px-3 py-2 font-mono text-sm text-warn" data-testid="engine-divergence">
              The browser engine printed something different from the verified native Go output ({JSON.stringify(verifiedTrap?.stdout)}). This is an engine bug; please report it.
            </p>
          )}
          {v.canContinue && state.step === "collide" && (
            <button className="btn btn-primary mt-6" data-testid="continue" onClick={() => dispatch({ type: "CONTINUE", at: Date.now() })}>
              Why? Decode it →
            </button>
          )}
        </StepSection>
      )}
    </>
  );
}
