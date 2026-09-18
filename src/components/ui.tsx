import type { ReactNode } from "react";

/** Visible marker for anything that is not built yet (spec §1.7: honest state). */
export function NotImplemented({ what, milestone }: { what?: string; milestone?: string }) {
  return (
    <span
      data-testid="not-implemented"
      className="inline-flex items-center gap-2 border border-bad px-2 py-0.5 font-mono text-[0.7rem] text-bad"
    >
      Not implemented{what ? ` · ${what}` : ""}
      {milestone ? ` · ${milestone}` : ""}
    </span>
  );
}

/** Wide-caps kicker above a heading, keyed with a cyan block. */
export function Caption({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`wide-caps flex items-center gap-2.5 text-ink-2 before:h-2 before:w-2 before:bg-accent before:content-[''] ${className}`}>{children}</p>
  );
}

/** Framed figure: hairline box with a cyan top edge and a caption row. */
export function Plate({ caption, aside, children, className = "" }: { caption?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`border border-rule border-t-2 border-t-accent bg-paper ${className}`}>
      {(caption || aside) && (
        <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-2.5">
          <span className="wide-caps text-ink-2">{caption}</span>
          {aside && <span className="font-mono text-[0.75rem] text-accent">{aside}</span>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function DisplayHeading({ children, as: Tag = "h1", className = "" }: { children: ReactNode; as?: "h1" | "h2"; className?: string }) {
  return <Tag className={`font-display font-extrabold leading-[0.98] tracking-[-0.02em] text-ink ${className}`}>{children}</Tag>;
}

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-6xl px-4 pb-24 sm:px-8 ${className}`}>{children}</main>;
}
