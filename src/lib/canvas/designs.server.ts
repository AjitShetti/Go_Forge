// Reading designs for the signed-in user. Every graph that comes back from the
// database goes through parseGraph: a row written outside the app (SQL editor,
// an old schema) shows as an explicit error instead of a broken canvas.
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServer, getCurrentUser } from "@/lib/supabase/server";
import { type DesignGraph, parseGraph } from "./graph";

export type DesignSummary = { designKey: string; name: string; latestVersion: number; versions: number; updatedAt: string; createdAt: string };
export type VersionMeta = { version: number; name: string; createdAt: string };
export type LoadedVersion = VersionMeta & { designKey: string; graph: DesignGraph };

export type Access = { kind: "not-configured" } | { kind: "signed-out" } | { kind: "ok"; supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServer>>> };

export async function designAccess(): Promise<Access> {
  if (!getSupabaseConfig()) return { kind: "not-configured" };
  const user = await getCurrentUser();
  if (!user) return { kind: "signed-out" };
  return { kind: "ok", supabase: (await createSupabaseServer())! };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Supabase = Extract<Access, { kind: "ok" }>["supabase"];

export async function listDesigns(supabase: Supabase): Promise<DesignSummary[]> {
  // RLS limits this to the caller's rows. Metadata only; graphs stay in the DB.
  const { data, error } = await supabase.from("designs").select("design_key, version, name, created_at").order("version", { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  const byKey = new Map<string, DesignSummary>();
  for (const r of data) {
    const s = byKey.get(r.design_key);
    if (!s) byKey.set(r.design_key, { designKey: r.design_key, name: r.name, latestVersion: r.version, versions: 1, updatedAt: r.created_at, createdAt: r.created_at });
    else {
      s.versions++;
      if (r.created_at < s.createdAt) s.createdAt = r.created_at;
    }
  }
  return [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listVersions(supabase: Supabase, designKey: string): Promise<VersionMeta[]> {
  const { data, error } = await supabase.from("designs").select("version, name, created_at").eq("design_key", designKey).order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((r) => ({ version: r.version, name: r.name, createdAt: r.created_at }));
}

export type VersionResult = { kind: "ok"; value: LoadedVersion } | { kind: "missing" } | { kind: "invalid"; errors: string[] };

/** One version, or the latest when `version` is null. */
export async function loadVersion(supabase: Supabase, designKey: string, version: number | null): Promise<VersionResult> {
  let q = supabase.from("designs").select("version, name, created_at, graph").eq("design_key", designKey);
  q = version === null ? q.order("version", { ascending: false }).limit(1) : q.eq("version", version).limit(1);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { kind: "missing" };
  const g = parseGraph(data.graph);
  if (!g.ok) return { kind: "invalid", errors: g.errors };
  return { kind: "ok", value: { designKey, version: data.version, name: data.name, createdAt: data.created_at, graph: g.value } };
}

export function parseVersionParam(v: string | string[] | undefined): number | null | "bad" {
  if (v === undefined) return null;
  if (typeof v !== "string" || !/^[1-9][0-9]{0,6}$/.test(v)) return "bad";
  return Number(v);
}
