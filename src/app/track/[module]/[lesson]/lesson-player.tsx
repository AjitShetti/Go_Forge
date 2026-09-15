"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChallengeStep } from "@/components/lesson/challenge-step";
import { CompleteStep } from "@/components/lesson/complete-step";
import { DecodeStep } from "@/components/lesson/decode-step";
import { ProvokeStep } from "@/components/lesson/provoke-step";
import { RebuildStep } from "@/components/lesson/rebuild-step";
import { SaveBadge, Stepper } from "@/components/lesson/chrome";
import { StretchStep } from "@/components/lesson/stretch-step";
import type { Dispatch } from "@/components/lesson/types";
import { Caption, PixelHeading } from "@/components/ui";
import type { LessonBundle } from "@/lib/content/load";
import { getExecutor } from "@/lib/engine/wasm-executor";
import { initialState, replay, transition, view, type LessonEvent, type LessonState } from "@/lib/lesson/machine";
import { NullRecorder, SupabaseRecorder, type LessonRecorder, type SaveStatus } from "@/lib/lesson/recorder";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export type PersistenceContext = { kind: "off"; reason: string } | { kind: "on"; userId: string; lessonId: string; trapConceptId: string | null };

declare global {
  interface Window {
    __lessonState?: LessonState;
  }
}

export function LessonPlayer({
  bundle,
  moduleCode,
  moduleTitle,
  lessonNumber,
  persistence,
}: {
  bundle: LessonBundle;
  moduleCode: string;
  moduleTitle: string;
  lessonNumber: number;
  persistence: PersistenceContext;
}) {
  const fm = bundle.lesson.frontmatter;
  const recorder: LessonRecorder = useMemo(() => {
    const supabase = getSupabaseBrowser();
    if (persistence.kind === "on" && supabase) return new SupabaseRecorder(supabase, persistence.userId, persistence.lessonId, persistence.trapConceptId);
    return new NullRecorder(persistence.kind === "off" ? persistence.reason : "Supabase client unavailable");
  }, [persistence]);

  const [state, setState] = useState<LessonState>(initialState);
  const stateRef = useRef(state);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "saving" });
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  const dispatch: Dispatch = useCallback(
    (event, extras) => {
      const from = stateRef.current;
      const result = transition(from, event);
      if (!result.ok) {
        setRejection(result.reason);
        return false;
      }
      setRejection(null);
      stateRef.current = result.state;
      setState(result.state);
      window.__lessonState = result.state;
      recorder.record(from, result.state, event, extras);
      return true;
    },
    [recorder],
  );

  useEffect(() => {
    recorder.onStatus(setSaveStatus);
    let cancelled = false;
    recorder.load().then(
      (events) => {
        if (cancelled) return;
        let s = replay(events);
        stateRef.current = s;
        // A run that was in flight when the tab closed never reported back.
        if (s.trapRunning) {
          const e: LessonEvent = { type: "TRAP_RUN_FAILED", at: Date.now() };
          const t = transition(s, e);
          recorder.record(s, t.state, e);
          s = t.state;
        }
        stateRef.current = s;
        setState(s);
        window.__lessonState = s;
        setLoaded(true);
      },
      (e: Error) => {
        if (!cancelled) setLoadError(e.message);
      },
    );
    getExecutor()
      .ready()
      .then(
        () => !cancelled && setEngineReady(true),
        (e: Error) => !cancelled && setEngineError(e.message),
      );
    return () => {
      cancelled = true;
    };
  }, [recorder]);

  const v = view(state);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-32 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-10">
        <Caption>
          <Link href="/track" className="hover:text-blue">
            Track
          </Link>{" "}
          · {moduleCode} {moduleTitle} · Lesson {String(lessonNumber).padStart(2, "0")}
        </Caption>
        <SaveBadge status={saveStatus} />
      </div>
      <PixelHeading className="mt-6 text-[clamp(2rem,5.5vw,3.6rem)]">{fm.title}</PixelHeading>
      <div className="mt-4 flex flex-wrap gap-2">
        {fm.concepts.map((c) => (
          <span key={c} className="border border-rule px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-2">
            {c}
          </span>
        ))}
      </div>

      <Stepper state={state} />

      {engineError && (
        <p className="mt-6 border border-bad px-3 py-2 font-mono text-sm text-bad" data-testid="engine-error">
          Engine failed to load: {engineError}
        </p>
      )}
      {loadError && (
        <p className="mt-6 border border-bad px-3 py-2 font-mono text-sm text-bad" data-testid="load-error">
          Could not load your saved progress: {loadError}. Nothing will be recorded until the page is reloaded.
        </p>
      )}
      {rejection && (
        <p className="mt-6 border border-warn px-3 py-2 font-mono text-sm text-warn" data-testid="rejection">
          {rejection}
        </p>
      )}

      {!loaded ? (
        <p className="mt-10 font-mono text-sm text-ink-3">{loadError ? "" : "Loading your progress…"}</p>
      ) : (
        <div className="mt-10 grid gap-14">
          <ProvokeStep bundle={bundle} state={state} dispatch={dispatch} engineReady={engineReady} />
          {v.showDecode && <DecodeStep bundle={bundle} state={state} dispatch={dispatch} />}
          {(state.step === "rebuild" || stepAfter(state, "rebuild")) && <RebuildStep bundle={bundle} state={state} dispatch={dispatch} engineReady={engineReady} />}
          {(state.step === "challenge" || stepAfter(state, "challenge")) && <ChallengeStep bundle={bundle} state={state} dispatch={dispatch} engineReady={engineReady} />}
          {(state.step === "stretch" || state.step === "complete") && <StretchStep bundle={bundle} state={state} dispatch={dispatch} />}
          {state.step === "complete" && <CompleteStep state={state} persistent={recorder.persistent} />}
        </div>
      )}
    </main>
  );
}

const ORDER = ["provoke", "collide", "decode", "rebuild", "challenge", "stretch", "complete"];
function stepAfter(s: LessonState, step: string) {
  return ORDER.indexOf(s.step) > ORDER.indexOf(step);
}
