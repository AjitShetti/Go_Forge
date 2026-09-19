import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { friendlyAuthError } from "@/lib/auth/auth-errors";
import { safeNext } from "@/lib/auth/safe-next";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Magic-link and OAuth landing. Handles every link style Supabase can send:
 * token hash (?token_hash=&type=), which works in any browser, and
 * PKCE (?code=), which only works in the browser that started sign-in.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const fail = (message: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));

  // Supabase redirects here with ?error=…&error_code=… when the link itself was rejected.
  const upstreamError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (upstreamError) return fail(friendlyAuthError({ message: upstreamError, code: url.searchParams.get("error_code") }));

  const supabase = await createSupabaseServer();
  if (!supabase) return fail("Supabase is not configured");

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(friendlyAuthError(error));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(friendlyAuthError(error));
  } else {
    return fail("The sign-in link is missing its code. Request a new one.");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
