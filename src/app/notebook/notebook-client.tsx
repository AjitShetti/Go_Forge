"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addNote, deleteEntry } from "./actions";
import { NOTE_LIMIT } from "./limits";

export function NoteForm({ lessons }: { lessons: { ref: string; label: string }[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [lessonRef, setLessonRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await addNote({ body, lessonRef: lessonRef || null }).catch((err: Error) => ({ ok: false as const, error: err.message }));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="panel mt-8 grid gap-3 p-4" data-testid="note-form">
      <label className="grid gap-2">
        <span className="label">New note</span>
        <textarea
          className="field min-h-28 font-mono text-sm"
          data-testid="note-body"
          value={body}
          maxLength={NOTE_LIMIT}
          placeholder="What clicked, what didn't, what to try next"
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <select className="field max-w-full py-1.5 text-[0.8rem]" data-testid="note-lesson" value={lessonRef} onChange={(e) => setLessonRef(e.target.value)}>
          <option value="">Not about a lesson</option>
          {lessons.map((l) => (
            <option key={l.ref} value={l.ref}>
              {l.label}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" data-testid="add-note" disabled={busy || body.trim() === ""}>
          {busy ? "Saving…" : "Save note"}
        </button>
        {error && (
          <span className="font-mono text-sm text-bad" data-testid="note-error">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

export function DeleteEntryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        data-testid="delete-entry"
        disabled={busy}
        className="border border-bad px-2 py-0.5 font-mono text-[0.7rem] text-bad hover:bg-paper-2 disabled:opacity-40"
        onClick={async () => {
          if (!window.confirm("Delete this entry? This can't be undone.")) return;
          setBusy(true);
          const res = await deleteEntry(id).catch((e: Error) => ({ ok: false as const, error: e.message }));
          setBusy(false);
          if (!res.ok) setError(res.error);
          else router.refresh();
        }}
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="font-mono text-[0.7rem] text-bad">{error}</span>}
    </span>
  );
}
