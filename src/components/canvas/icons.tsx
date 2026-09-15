import type { NodeKind } from "@/lib/canvas/catalog";

// Thin line art in the style of the figure plates: 24×24, 1.5px strokes.
const PATHS: Record<NodeKind, React.ReactNode> = {
  client: (
    <>
      <rect x="3" y="4" width="13" height="10" />
      <path d="M7 18h5M9.5 14v4" />
      <rect x="17" y="8" width="5" height="11" />
      <path d="M19 17h1" />
    </>
  ),
  cdn: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c-2.8 2.6-2.8 14.4 0 17M12 3.5c2.8 2.6 2.8 14.4 0 17" />
    </>
  ),
  load_balancer: (
    <>
      <circle cx="5" cy="12" r="2" />
      <path d="M7 12h4M11 12l8-6M11 12h8M11 12l8 6" />
      <path d="M17 4.5 19.5 6 18 8.5M17.5 10.5 19.5 12 17.5 13.5M18 15.5 19.5 18 17 19.5" />
    </>
  ),
  api_gateway: (
    <>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9 20v-6h6v6M4 20h16" />
    </>
  ),
  app_service: (
    <>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M8 9l3 3-3 3M13 15h3" />
    </>
  ),
  worker: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  queue: (
    <>
      <path d="M3 7h18v10H3z" />
      <path d="M7.5 7v10M12 7v10M16.5 7v10" />
      <path d="M1 12h1M22 12h1" />
    </>
  ),
  cache: (
    <>
      <path d="M13 2 5 13.5h6L10 22l9-12h-6z" />
    </>
  ),
  sql_db: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
  nosql: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" />
    </>
  ),
  object_store: (
    <>
      <path d="M4 7h16l-1.5 13h-13z" />
      <path d="M3 4h18v3H3z" />
      <path d="M10 11h4" />
    </>
  ),
  search_index: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="M14.5 14.5 21 21M7 10h6M10 7v6" />
    </>
  ),
  rate_limiter: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17l4-6M3 17h18" />
    </>
  ),
  pubsub: (
    <>
      <circle cx="5" cy="12" r="2" />
      <path d="M7 12h3M10 12l4-6h5M10 12h9M10 12l4 6h5" />
    </>
  ),
  cron: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 8.5V13l3 2M9 2h6" />
    </>
  ),
};

export function NodeIcon({ kind, className = "h-5 w-5" }: { kind: NodeKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="square" strokeLinejoin="miter" className={className} aria-hidden>
      {PATHS[kind]}
    </svg>
  );
}
