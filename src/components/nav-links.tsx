"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/track", label: "Track" },
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
