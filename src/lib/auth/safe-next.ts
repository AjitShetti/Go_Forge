/**
 * Where to send someone after sign-in: only a same-origin path.
 * "//evil.com" and "/\evil.com" start with "/" but resolve to another host,
 * so the resolved origin is what gets checked, not the first character.
 */
export function safeNext(raw: string | null | undefined, fallback = "/track"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  try {
    const base = "http://goforge.invalid";
    const resolved = new URL(raw, base);
    return resolved.origin === base ? resolved.pathname + resolved.search + resolved.hash : fallback;
  } catch {
    return fallback;
  }
}
