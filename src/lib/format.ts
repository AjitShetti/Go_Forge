/**
 * "2026-09-15 16:48 UTC". Server-rendered pages can't know the viewer's time
 * zone, so every timestamp in the app uses UTC to read the same everywhere.
 */
export function utcStamp(iso: string | number | Date): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
