import type { ReactNode } from "react";

/** Visible marker for anything that is not built yet (spec §1.7: honest state). */
export function NotImplemented({ what, milestone }: { what?: string; milestone?: string }) {
  return (
    <span
      data-testid="not-implemented"
      className="inline-flex items-center gap-2 border border-bad px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.14em] text-bad uppercase"
    >
      Not implemented{what ? ` · ${what}` : ""}
      {milestone ? ` · ${milestone}` : ""}
    </span>
  );
}

/** Small mono uppercase label above a heading. */
export function Caption({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`label ${className}`}>{children}</p>;
}

/** Panel framed by blue corner brackets, as in the reference design's figure plates. */
export function Plate({ caption, aside, children, className = "" }: { caption?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  const corner = "pointer-events-none absolute h-4 w-4 border-blue";
  return (
    <div className={`relative border border-rule bg-paper/80 p-5 ${className}`}>
      <span className={`${corner} -top-px -left-px border-t-2 border-l-2`} />
      <span className={`${corner} -top-px -right-px border-t-2 border-r-2`} />
      <span className={`${corner} -bottom-px -left-px border-b-2 border-l-2`} />
      <span className={`${corner} -right-px -bottom-px border-r-2 border-b-2`} />
      {(caption || aside) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <span className="label text-[0.66rem]">{caption}</span>
          {aside && <span className="font-mono text-[0.72rem] text-blue">{aside}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function PixelHeading({ children, as: Tag = "h1", className = "" }: { children: ReactNode; as?: "h1" | "h2"; className?: string }) {
  return <Tag className={`font-pixel font-bold leading-[0.95] tracking-tight text-blue uppercase ${className}`}>{children}</Tag>;
}

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-6xl px-4 pb-24 sm:px-8 ${className}`}>{children}</main>;
}
