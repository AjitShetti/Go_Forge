"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let client: SupabaseClient | null | undefined;

/** Browser client (singleton). Null when Supabase is not configured. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (client === undefined) {
    const config = getSupabaseConfig();
    client = config ? createBrowserClient(config.url, config.key) : null;
  }
  return client;
}
