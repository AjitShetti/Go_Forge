"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Auth = { kind: "unknown" } | { kind: "unconfigured" } | { kind: "signed-out" } | { kind: "signed-in"; email: string | null };

/**
 * Who is signed in, resolved in the browser.
 *
 * This used to be read on the server inside SiteHeader, which put a cookie read in
 * the root layout and so made every route in the app dynamic: nothing could be
 * prerendered or cached at the edge, and each of the RSC prefetches a page fires
 * became a full server render. Reading it here instead is what lets the content
 * routes be static.
 *
 * The slot keeps its size while `kind` is "unknown", so resolving the session does
 * not shift the nav next to it.
 */
export function AuthNav() {
  const [auth, setAuth] = useState<Auth>(() => (getSupabaseConfig() ? { kind: "unknown" } : { kind: "unconfigured" }));

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setAuth({ kind: "unconfigured" });
      return;
    }
    let cancelled = false;
    const apply = (claims: { sub?: string; email?: unknown } | null | undefined) => {
      if (cancelled) return;
      setAuth(claims?.sub ? { kind: "signed-in", email: (claims.email as string | undefined) ?? null } : { kind: "signed-out" });
    };
    supabase.auth.getClaims().then(
      ({ data }) => apply(data?.claims),
      () => !cancelled && setAuth({ kind: "signed-out" }),
    );
    // Keeps the header honest after a sign-in, sign-out or token refresh in this tab.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getClaims().then(({ data }) => apply(data?.claims), () => {});
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <span className="ml-3 flex min-h-[2rem] items-center" data-testid="auth-nav" data-auth={auth.kind}>
      {auth.kind === "unconfigured" ? (
        <span
          data-testid="supabase-status"
          title="NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Nothing is saved."
          className="border border-bad/50 px-2 py-1 font-mono text-[0.72rem] text-bad"
        >
          DB not connected
        </span>
      ) : auth.kind === "signed-in" ? (
        <form action="/auth/signout" method="post" className="flex items-center gap-3">
          <span data-testid="user-email" className="font-mono text-[0.75rem] text-ink-3">
            {auth.email}
          </span>
          <button className="border border-line px-3 py-1.5 text-[0.85rem] font-medium transition-colors hover:border-ink">Sign out</button>
        </form>
      ) : auth.kind === "signed-out" ? (
        <Link href="/login" prefetch={false} className="bg-accent px-4 py-1.5 text-[0.88rem] font-semibold text-on-accent transition-colors hover:bg-accent-strong">
          Sign in
        </Link>
      ) : null}
    </span>
  );
}
