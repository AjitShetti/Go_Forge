import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Magic-link landing. Handles both link styles Supabase can send:
 * PKCE (?code=) and token hash (?token_hash=&type=).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/track";
  const fail = (message: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));

  const supabase = await createSupabaseServer();
  if (!supabase) return fail("Supabase is not configured");

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.message);
  } else {
    return fail("The sign-in link is missing its code");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
