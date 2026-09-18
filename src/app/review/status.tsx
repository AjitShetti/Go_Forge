import Link from "next/link";
import type { ConceptStatus } from "@/lib/review/mastery";
import type { LearnerView } from "./learner";

const STATUS_STYLE: Record<ConceptStatus, string> = {
  new: "border-rule text-ink-3",
  learning: "border-warn text-warn",
  review: "border-accent text-accent",
  mastered: "border-ok text-ok",
};

export function StatusChip({ status }: { status: ConceptStatus }) {
  return (
    <span data-status={status} className={`border px-1.5 py-0.5 font-mono text-[0.68rem] ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

/** The honest "nothing to show" states shared by /review and /dashboard. */
export function LearnerGate({ view, what }: { view: Exclude<LearnerView, { kind: "ok" }>; what: string }) {
  const box = "panel mt-8 max-w-2xl p-5";
  switch (view.kind) {
    case "not-configured":
      return (
        <div className={box} data-testid="learner-gate" data-kind="not-configured">
          <p className="font-mono text-[0.75rem] text-bad">DB not connected</p>
          <p className="prose-serif mt-2 text-ink-2">Supabase isn't configured, so there's no history to build {what} from. Nothing is recorded in this mode.</p>
        </div>
      );
    case "signed-out":
      return (
        <div className={box} data-testid="learner-gate" data-kind="signed-out">
          <p className="prose-serif text-ink-2">
            {what.charAt(0).toUpperCase() + what.slice(1)} is built from your own predictions and challenge attempts.{" "}
            <Link href="/login" className="text-accent underline underline-offset-2">
              Sign in
            </Link>{" "}
            to see it.
          </p>
        </div>
      );
    case "error":
      return (
        <div className={box} data-testid="learner-gate" data-kind="error">
          <p className="font-mono text-[0.75rem] text-bad">Could not load your history</p>
          <p className="mt-2 font-mono text-sm text-ink-2">{view.message}</p>
        </div>
      );
  }
}
