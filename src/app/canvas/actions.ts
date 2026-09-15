"use server";

import { revalidatePath } from "next/cache";
import { designAccess, loadVersion, UUID } from "@/lib/canvas/designs.server";
import { canonicalGraph, parseGraph, parseName, sameGraph } from "@/lib/canvas/graph";
import { scenarioBySlug } from "@/lib/grader/scenarios";

export type SaveResult =
  | { ok: true; designKey: string; version: number; name: string; createdAt: string }
  | { ok: false; error: string; conflict?: { latestVersion: number } };

const signedOutError = (kind: "not-configured" | "signed-out") =>
  kind === "not-configured" ? "Supabase is not configured, so designs can't be saved. Export the JSON instead." : "You are signed out. Sign in to save, or export the JSON.";

/**
 * Saves a design as a new immutable version.
 *
 * `baseVersion` is the version the editor started from. If a newer version
 * exists (another tab saved), the save is refused with `conflict` unless
 * `force` is set, so one tab never silently buries another's work.
 *
 * No revalidatePath: it re-renders the page the editor is on and would
 * remount it, dropping selection, viewport and open panels. Every canvas
 * page is dynamic, so the next visit reads fresh rows anyway.
 */
export async function saveDesignVersion(input: { designKey: string | null; baseVersion: number | null; name: unknown; graph: unknown; scenario?: string | null; force?: boolean }): Promise<SaveResult> {
  const access = await designAccess();
  if (access.kind !== "ok") return { ok: false, error: signedOutError(access.kind) };
  const name = parseName(input.name);
  if (!name.ok) return { ok: false, error: name.errors.join("; ") };
  const graph = parseGraph(input.graph);
  if (!graph.ok) return { ok: false, error: `The design is not valid: ${graph.errors.slice(0, 5).join("; ")}${graph.errors.length > 5 ? ` (+${graph.errors.length - 5} more)` : ""}` };
  const { supabase } = access;
  const scenarioSlug = input.scenario ?? null;
  if (scenarioSlug !== null && !scenarioBySlug(scenarioSlug)) return { ok: false, error: `Unknown scenario "${String(scenarioSlug)}".` };
  let scenario_id: string | null = null;
  if (scenarioSlug !== null) {
    const { data, error } = await supabase.from("scenarios").select("id").eq("slug", scenarioSlug).maybeSingle();
    if (error || !data) return { ok: false, error: `Scenario "${scenarioSlug}" is not in the database: ${error?.message ?? "apply migration 20260915000600_scenarios_p7.sql"}` };
    scenario_id = data.id;
  }
  const row = { name: name.value, graph: canonicalGraph(graph.value), scenario_id };

  if (input.designKey === null) {
    const { data, error } = await supabase.from("designs").insert({ ...row, version: 1 }).select("design_key, version, name, created_at").single();
    if (error) return { ok: false, error: `Could not save: ${error.message}` };
    return { ok: true, designKey: data.design_key, version: data.version, name: data.name, createdAt: data.created_at };
  }

  if (!UUID.test(input.designKey)) return { ok: false, error: "Unknown design." };
  const latest = await loadVersion(supabase, input.designKey, null).catch((e: Error) => ({ kind: "error" as const, message: e.message }));
  if (latest.kind === "error") return { ok: false, error: `Could not save: ${latest.message}` };
  if (latest.kind === "missing") return { ok: false, error: "This design no longer exists (it may have been deleted in another tab). Export the JSON to keep your work." };
  const latestVersion = latest.kind === "ok" ? latest.value.version : await latestVersionNumber(supabase, input.designKey);
  if (latestVersion !== input.baseVersion && !input.force) {
    return { ok: false, error: `Version ${latestVersion} was saved after the version you are editing (${input.baseVersion ?? "none"}).`, conflict: { latestVersion } };
  }
  if (latest.kind === "ok" && latest.value.version === input.baseVersion && latest.value.name === name.value && latest.value.scenarioSlug === scenarioSlug && sameGraph(latest.value.graph, graph.value)) {
    return { ok: false, error: `No changes since version ${latestVersion}.` };
  }

  const { data, error } = await supabase
    .from("designs")
    .insert({ ...row, design_key: input.designKey, version: latestVersion + 1 })
    .select("design_key, version, name, created_at")
    .single();
  if (error) {
    // 23505: two saves raced for the same version number.
    if (error.code === "23505") return { ok: false, error: `Another save took version ${latestVersion + 1} first.`, conflict: { latestVersion: latestVersion + 1 } };
    return { ok: false, error: `Could not save: ${error.message}` };
  }
  return { ok: true, designKey: data.design_key, version: data.version, name: data.name, createdAt: data.created_at };
}

async function latestVersionNumber(supabase: Extract<Awaited<ReturnType<typeof designAccess>>, { kind: "ok" }>["supabase"], designKey: string): Promise<number> {
  const { data, error } = await supabase.from("designs").select("version").eq("design_key", designKey).order("version", { ascending: false }).limit(1).single();
  if (error) throw new Error(error.message);
  return data.version;
}

export async function deleteDesign(designKey: string): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const access = await designAccess();
  if (access.kind !== "ok") return { ok: false, error: signedOutError(access.kind) };
  if (!UUID.test(designKey)) return { ok: false, error: "Unknown design." };
  const { data, error } = await access.supabase.from("designs").delete().eq("design_key", designKey).select("id");
  if (error) return { ok: false, error: `Could not delete: ${error.message}` };
  if (data.length === 0) return { ok: false, error: "Nothing to delete: this design doesn't exist or isn't yours." };
  revalidatePath("/canvas");
  return { ok: true, deleted: data.length };
}
