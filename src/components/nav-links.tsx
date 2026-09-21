"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Default ("auto") prefetching, which is not the same thing for every route here:
 * the prerendered ones (Track, Reference, Scenarios, Engine) are fetched whole,
 * while Review, Progress, Canvas and Notebook are fetched only as far as their
 * loading.tsx. That boundary is what makes the default affordable - without one,
 * prefetching a dynamic route pulls a full server render of a page most readers
 * never open, which is why these four were briefly set to `false`. They should not
 * be: in the App Router `false` also turns off prefetching on hover, so every visit
 * to them paid the whole ~400ms server render after the click.
 */
const NAV = [
  { href: "/track", label: "Track" },
  { href: "/go", label: "Reference" },
  { href: "/review", label: "Review" },
  { href: "/dashboard", label: "Progress" },
  { href: "/canvas", label: "Canvas" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/notebook", label: "Notebook" },
  { href: "/engine", label: "Engine" },
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
