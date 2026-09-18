"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type ReviewAnswerResult, submitReviewAnswer } from "../actions";

/** What the browser is allowed to know about a card before answering: no answer, no output. */
export type PublicCard = {
  id: string;
  lessonTitle: string;
  lessonHref: string;
  code: string;
  kind: "output" | "choice";
  question: string;
  choices?: string[];
};

export function ReviewCardView({ card, concept, goVersion, seenBefore }: { card: PublicCard; concept: string; goVersion: string | null; seenBefore: boolean }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ReviewAnswerResult | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = result?.ok === true;

  const submit = () =>
    startTransition(async () => {
      setResult(await submitReviewAnswer({ cardId: card.id, concept, answer }));
    });

  return (
    <div className="mt-8 grid gap-6" data-testid="review-card" data-card={card.id}>
      <figure className="panel">
        <div className="panel-head">
          <span className="label">
            main.go · from{" "}
            <Link href={card.lessonHref} className="text-accent hover:underline">
              {card.lessonTitle}
            </Link>
          </span>
          {seenBefore && <span className="label text-warn">seen before · not a first try</span>}
        </div>
        <pre className="code-block overflow-x-auto p-4">{card.code}</pre>
      </figure>

      <div className="panel p-5">
        <p className="prose-serif text-lg">{card.question}</p>
        {card.kind === "choice" ? (
          <div className="mt-4 grid gap-2" role="radiogroup">
            {card.choices!.map((c, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={answer === c}
                data-testid={`choice-${i}`}
                disabled={locked || pending}
                onClick={() => setAnswer(c)}
                className={`border px-4 py-2.5 text-left font-mono text-sm whitespace-pre-wrap ${answer === c ? "border-accent bg-accent-soft" : "border-rule bg-paper hover:border-line"}`}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            data-testid="answer-text"
            className="field mt-4 min-h-28"
            placeholder="Type exactly what it prints"
            value={answer}
            disabled={locked || pending}
            onChange={(e) => setAnswer(e.target.value)}
          />
        )}
        {!locked && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-solid" data-testid="submit-answer" disabled={answer.trim() === "" || pending} onClick={submit}>
              {pending ? "Checking…" : "Lock in answer"}
            </button>
            <span className="label normal-case">The real output stays hidden until you commit.</span>
          </div>
        )}
        {result?.ok === false && (
          <p className="mt-3 font-mono text-sm text-bad" data-testid="answer-error">
            {result.error}
          </p>
        )}
      </div>

      {result?.ok && (
        <section className="panel" data-testid="review-result" data-correct={result.correct}>
          <div className="panel-head">
            <span className={`font-mono text-sm ${result.correct ? "text-ok" : "text-bad"}`}>{result.correct ? "Match" : "Mismatch"}</span>
            <span className="label">real output{goVersion ? ` · ${goVersion}` : ""}</span>
          </div>
          <div className="grid gap-px bg-rule md:grid-cols-2">
            <div className="bg-paper p-4">
              <p className="label mb-2">You said</p>
              <pre className="code-block">{answer}</pre>
            </div>
            <div className="bg-paper p-4">
              <p className="label mb-2">Go {card.kind === "choice" ? "did" : "printed"}</p>
              <pre className="code-block">
                {result.real.stdout}
                {result.real.stderr && <span className="text-bad">{result.real.stderr}</span>}
              </pre>
              <p className="label mt-2">exit status {result.real.exitCode}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-rule px-4 py-3">
            {!result.correct && (
              <Link href={card.lessonHref} className="btn px-3 py-1.5 text-[0.8rem]">
                Reread the lesson
              </Link>
            )}
            <button type="button" className="btn btn-primary px-3 py-1.5 text-[0.8rem]" data-testid="next-card" onClick={() => router.refresh()}>
              Next question →
            </button>
            <Link href="/review" className="label hover:text-accent">
              back to queue
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
