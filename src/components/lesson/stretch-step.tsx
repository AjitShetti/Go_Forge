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
            placeholder="Your program, notes, or explanation. Saved to your notebook."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn btn-primary" data-testid="submit-stretch" disabled={body.trim() === ""} onClick={() => dispatch({ type: "SUBMIT_STRETCH", body, at: Date.now() })}>
              Save to notebook
            </button>
            <button className="btn" data-testid="skip-stretch" onClick={() => dispatch({ type: "SKIP_STRETCH", at: Date.now() })}>
              Skip
            </button>
          </div>
        </>
      ) : (
        <p className="label mt-4">{state.stretchSubmitted ? "Saved to notebook." : "Skipped."}</p>
      )}
    </StepSection>
  );
}
