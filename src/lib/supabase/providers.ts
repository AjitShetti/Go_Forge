import { getSupabaseConfig } from "./config";

export type OAuthProvider = "github" | "google";

/**
 * OAuth providers switched on in the Supabase dashboard, read from the public
 * /auth/v1/settings endpoint. A sign-in button only shows once its provider works.
 */
export async function getEnabledOAuthProviders(): Promise<OAuthProvider[]> {
  const config = getSupabaseConfig();
  if (!config) return [];
  try {
    const res = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const { external } = (await res.json()) as { external?: Record<string, boolean> };
    return (["github", "google"] as const).filter((p) => external?.[p] === true);
  } catch {
    return [];
  }
}
