"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * `prefetch: false` on the personal routes. The header is on every page and always
 * in the viewport, so the router prefetched all eight of these on every page view —
 * and Review, Progress, Canvas and Notebook are the four that cannot be prerendered,
 * so each prefetch was a server render of a page that a signed-out reader (and every
 * crawler) will never open. The static ones are a cheap file read and stay prefetched.
 */
const NAV = [
  { href: "/track", label: "Track", prefetch: true },
  { href: "/go", label: "Reference", prefetch: true },
  { href: "/review", label: "Review", prefetch: false },
  { href: "/dashboard", label: "Progress", prefetch: false },
  { href: "/canvas", label: "Canvas", prefetch: false },
  { href: "/scenarios", label: "Scenarios", prefetch: true },
  { href: "/notebook", label: "Notebook", prefetch: false },
  { href: "/engine", label: "Engine", prefetch: true },
];

/** Main nav; the current section carries a cyan bar on the header's bottom rule. */
export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            prefetch={n.prefetch}
            aria-current={active ? "page" : undefined}
            className={`relative px-2.5 py-2 text-[0.88rem] font-medium transition-colors after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-0.5 after:content-[''] ${active ? "text-ink after:bg-accent" : "text-ink-2 hover:text-ink"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
