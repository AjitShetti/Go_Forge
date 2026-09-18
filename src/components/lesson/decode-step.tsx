"use client";

import { Markdown } from "@/components/markdown";
import { view } from "@/lib/lesson/machine";
import { StepSection } from "./chrome";
import type { StepProps } from "./types";

export function DecodeStep({ bundle, state, dispatch }: StepProps) {
  const v = view(state);
  const verified = Object.fromEntries(Object.entries(bundle.expected.blocks).map(([id, b]) => [id, b.real]));
  const contrast = bundle.lesson.sections["Python/JS contrast"];
  return (
    <StepSection id="decode" n={3} title="Decode" done={state.step !== "decode"}>
      {bundle.lesson.sections.Decode && <Markdown source={bundle.lesson.sections.Decode} verified={verified} goVersion={bundle.expected.goVersion} />}
      {contrast && (
        <details
          className="panel mt-8"
          data-testid="contrast"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) dispatch({ type: "EXPAND_SECTION", section: "Python/JS contrast", at: Date.now() });
          }}
        >
          <summary className="panel-head cursor-pointer">
            <span className="label">Python / JavaScript contrast</span>
            <span className="label text-accent">expand</span>
          </summary>
          <div className="p-5">
            <Markdown source={contrast} />
          </div>
        </details>
      )}
      {v.canContinue && state.step === "decode" && (
        <button className="btn btn-primary mt-8" data-testid="continue" onClick={() => dispatch({ type: "CONTINUE", at: Date.now() })}>
          Rebuild it yourself →
        </button>
      )}
    </StepSection>
  );
}
