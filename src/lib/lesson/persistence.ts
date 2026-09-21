"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export type PersistenceContext = { kind: "off"; reason: string } | { kind: "on"; userId: string; lessonId: string; trapConceptId: string | null };

/**
 * Whether this lesson can record events, and the ids it records against.
 *
 * This is resolved in the browser rather than on the server so the lesson route has
 * no cookie read in it and can be prerendered — the lesson pages are the site's
 * search-facing content, and a dynamic route is neither cached nor cheap to crawl.
 * `lessons` and `concepts` are readable by `anon` (migration 20260915000000_init.sql),
 * so the two lookups work signed in or out.
 */
export async function resolvePersistence(ref: string, trapConcept: string): Promise<PersistenceContext> {
  const supabase: SupabaseClient | null = getSupabaseBrowser();
  if (!supabase) return { kind: "off", reason: "Supabase is not configured" };

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { kind: "off", reason: "You are not signed in" };

  const [{ data: lessonRow, error: lessonErr }, { data: conceptRow }] = await Promise.all([
    supabase.from("lessons").select("id").eq("content_ref", ref).maybeSingle(),
    supabase.from("concepts").select("id").eq("slug", trapConcept).maybeSingle(),
  ]);
  if (lessonErr || !lessonRow) return { kind: "off", reason: `Lesson ${ref} is not in the database yet` };
  return { kind: "on", userId, lessonId: lessonRow.id as string, trapConceptId: (conceptRow?.id as string | undefined) ?? null };
}
