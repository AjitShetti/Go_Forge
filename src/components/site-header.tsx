import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { NavLinks } from "@/components/nav-links";

/**
 * Static chrome. Nothing here reads cookies: the signed-in state lives in AuthNav
 * and resolves in the browser, which is what keeps this layout — and therefore every
 * route under it — prerenderable.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ground/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-2.5 sm:px-8">
        <Link href="/" className="font-display text-[1.15rem] font-extrabold tracking-[-0.01em] text-ink" aria-label="Go Forge home">
          <span className="text-accent">Go</span>Forge
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-y-1">
          <NavLinks />
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
