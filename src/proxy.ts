import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

/** Refreshes the Supabase auth session cookie on each page request. */
export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Only the routes that read the session on the server. The lessons, the track,
  // the scenarios and the home page are prerendered and read no cookies, so running
  // this on them bought nothing and cost a Supabase round trip per request - and a
  // response carrying Set-Cookie is one the CDN will not cache.
  //
  // Sessions stay fresh on the public pages regardless: the browser client refreshes
  // its own token and writes the cookies these routes then read.
  matcher: ["/review/:path*", "/canvas/:path*", "/login", "/auth/:path*"],
};
