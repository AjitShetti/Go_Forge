import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

const NAV = [
  { href: "/track", label: "Track" },
  { href: "/review", label: "Review" },
  { href: "/dashboard", label: "Progress" },
  { href: "/canvas", label: "Canvas" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/notebook", label: "Notebook" },
  { href: "/engine", label: "Engine" },
];

export async function SiteHeader() {
  const configured = getSupabaseConfig() !== null;
  const user = configured ? await getCurrentUser() : null;

  return (
    <header className="border-b border-rule bg-paper/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3 font-pixel text-lg font-bold tracking-wide text-blue uppercase">
          <span aria-hidden className="inline-block h-3.5 w-3.5 bg-blue" />
          Go / Forge
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="font-mono text-[0.8rem] tracking-[0.14em] uppercase hover:text-blue">
              {n.label}
            </Link>
          ))}
          {!configured ? (
            <span
              data-testid="supabase-status"
              title="NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Nothing is saved."
              className="border border-bad px-2 py-1 font-mono text-[0.7rem] tracking-[0.14em] text-bad uppercase"
            >
              DB not connected
            </span>
          ) : user ? (
            <form action="/auth/signout" method="post" className="flex items-center gap-3">
              <span data-testid="user-email" className="font-mono text-[0.75rem] text-ink-2">
                {user.email}
              </span>
              <button className="border border-ink px-3 py-1 font-mono text-[0.75rem] tracking-[0.12em] uppercase hover:bg-paper-2">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="border border-blue px-3 py-1 font-mono text-[0.75rem] tracking-[0.12em] text-blue uppercase hover:bg-blue-soft">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
