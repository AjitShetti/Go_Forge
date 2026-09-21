"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { StepSection } from "./chrome";
import type { StepProps } from "./types";

export function StretchStep({ bundle, state, dispatch }: StepProps) {
  const [body, setBody] = useState("");
  const active = state.step === "stretch";
  return (
    <StepSection id="stretch" n={6} title="Stretch · optional, ungraded" done={!active}>
      {bundle.lesson.sections.Stretch && <Markdown source={bundle.lesson.sections.Stretch} />}
      {active ? (
        <>
          <textarea
            data-testid="stretch-body"
            className="field code-block mt-5 h-44"
            placeholder="Your program, notes, or explanation. Kept with this lesson."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn btn-primary" data-testid="submit-stretch" disabled={body.trim() === ""} onClick={() => dispatch({ type: "SUBMIT_STRETCH", body, at: Date.now() })}>
              Save answer
            </button>
            <button className="btn" data-testid="skip-stretch" onClick={() => dispatch({ type: "SKIP_STRETCH", at: Date.now() })}>
              Skip
            </button>
          </div>
        </>
      ) : state.stretchSubmitted ? (
        // Shown back rather than filed away somewhere else: this is the only place
        // the answer lives now, and it is here whenever the lesson is reopened.
        <div className="mt-5">
          <p className="label">Your answer</p>
          <pre className="code-block mt-2 whitespace-pre-wrap" data-testid="stretch-answer">
            {state.stretchBody}
          </pre>
        </div>
      ) : (
        <p className="label mt-4">Skipped.</p>
      )}
    </StepSection>
  );
}
