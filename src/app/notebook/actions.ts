"use server";

import { revalidatePath } from "next/cache";
import { designAccess, UUID } from "@/lib/canvas/designs.server";
import { findLesson } from "@/lib/content/track";
import { NOTE_LIMIT } from "./limits";

export type NotebookResult = { ok: true } | { ok: false; error: string };

const REF = /^go\/([a-z0-9-]+)\/([a-z0-9-]+)$/;

/** Adds a free note, optionally attached to a lesson (by content_ref). */
export async function addNote(input: { body: unknown; lessonRef: unknown }): Promise<NotebookResult> {
  const access = await designAccess();
  if (access.kind !== "ok") return { ok: false, error: access.kind === "signed-out" ? "You are signed out. Sign in to keep notes." : "Supabase is not configured." };
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body === "") return { ok: false, error: "Write something first." };
  if (body.length > NOTE_LIMIT) return { ok: false, error: `Notes are limited to ${NOTE_LIMIT.toLocaleString("en")} characters.` };

  let lesson_id: string | null = null;
  if (input.lessonRef !== null && input.lessonRef !== "") {
    const m = typeof input.lessonRef === "string" ? REF.exec(input.lessonRef) : null;
    if (!m || !findLesson(m[1], m[2])) return { ok: false, error: "Unknown lesson." };
    const { data, error } = await access.supabase.from("lessons").select("id").eq("content_ref", input.lessonRef).maybeSingle();
    if (error || !data) return { ok: false, error: `Lesson is not in the database: ${error?.message ?? "run supabase/seed.sql"}` };
    lesson_id = data.id;
  }

  const { error } = await access.supabase.from("notebook").insert({ kind: "note", body, lesson_id });
  if (error) return { ok: false, error: `Could not save: ${error.message}` };
  revalidatePath("/notebook");
  return { ok: true };
}

/** Deletes one of the caller's entries. RLS makes another user's id a silent no-op, so check the row count. */
export async function deleteEntry(id: unknown): Promise<NotebookResult> {
  const access = await designAccess();
  if (access.kind !== "ok") return { ok: false, error: "You are signed out." };
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Unknown entry." };
  const { data, error } = await access.supabase.from("notebook").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: `Could not delete: ${error.message}` };
  if (!data?.length) return { ok: false, error: "That entry no longer exists." };
  revalidatePath("/notebook");
  return { ok: true };
}
