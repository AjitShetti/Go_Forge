"use server";

import { designAccess, loadVersion, UUID } from "@/lib/canvas/designs.server";
import { grade } from "@/lib/grader/grade";
import { scenarioBySlug } from "@/lib/grader/scenarios";
import type { GradeReport } from "@/lib/grader/types";

export type RecordResult = { ok: true; report: GradeReport; createdAt: string } | { ok: false; error: string };

/**
 * Grades a SAVED version on the server and records the result in
 * design_reviews. The graph and scenario come from the stored row, not from
 * the browser, so the recorded score always matches what was saved.
 */
export async function recordReview(input: { designKey: string; version: number }): Promise<RecordResult> {
  const access = await designAccess();
  if (access.kind !== "ok") return { ok: false, error: access.kind === "signed-out" ? "Signed out: the grade is shown but not recorded." : "Supabase is not configured: the grade is shown but not recorded." };
  if (!UUID.test(input.designKey) || !Number.isInteger(input.version) || input.version < 1) return { ok: false, error: "Unknown design version." };
  const loaded = await loadVersion(access.supabase, input.designKey, input.version).catch((e: Error) => ({ kind: "error" as const, message: e.message }));
  if (loaded.kind === "error") return { ok: false, error: `Could not load the version: ${loaded.message}` };
  if (loaded.kind !== "ok") return { ok: false, error: loaded.kind === "missing" ? "That version no longer exists." : "The stored graph is invalid." };
  const scenario = scenarioBySlug(loaded.value.scenarioSlug);
  if (!scenario) return { ok: false, error: `Version ${input.version} was saved without a scenario. Pick one and save before recording a grade.` };
  const report = grade(loaded.value.graph, scenario);
  const { data, error } = await access.supabase
    .from("design_reviews")
    .insert({ design_id: loaded.value.id, score: report.score, violations: report.violations, warnings: [...report.warnings, ...report.tradeoffs] })
    .select("created_at")
    .single();
  if (error) return { ok: false, error: `Could not record the grade: ${error.message}` };
  return { ok: true, report, createdAt: data.created_at };
}
