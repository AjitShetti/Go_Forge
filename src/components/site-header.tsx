import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export async function SiteHeader() {
  const configured = getSupabaseConfig() !== null;
  const user = configured ? await getCurrentUser() : null;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ground/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-2.5 sm:px-8">
        <Link href="/" className="font-display text-[1.15rem] font-extrabold tracking-[-0.01em] text-ink" aria-label="Go Forge home">
          <span className="text-accent">Go</span>Forge
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-y-1">
          <NavLinks />
          {!configured ? (
            <span
              data-testid="supabase-status"
              title="NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Nothing is saved."
              className="ml-3 border border-bad/50 px-2 py-1 font-mono text-[0.72rem] text-bad"
            >
              DB not connected
            </span>
          ) : user ? (
            <form action="/auth/signout" method="post" className="ml-3 flex items-center gap-3">
              <span data-testid="user-email" className="font-mono text-[0.75rem] text-ink-3">
                {user.email}
              </span>
              <button className="border border-line px-3 py-1.5 text-[0.85rem] font-medium transition-colors hover:border-ink">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="ml-3 bg-accent px-4 py-1.5 text-[0.88rem] font-semibold text-on-accent transition-colors hover:bg-accent-strong">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
