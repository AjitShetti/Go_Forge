/**
 * Supabase connection settings. When they are missing the app still runs, but
 * shows a visible NOT CONNECTED state and persists nothing.
 * Accepts the new publishable key name and the legacy anon key name.
 */
export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}
