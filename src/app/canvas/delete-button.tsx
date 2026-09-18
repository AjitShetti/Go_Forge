"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDesign } from "./actions";

export function DeleteDesignButton({ designKey, name, versions }: { designKey: string; name: string; versions: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        data-testid="delete-design"
        disabled={busy}
        className="border border-bad px-2 py-0.5 font-mono text-[0.7rem] text-bad hover:bg-paper-2 disabled:opacity-40"
        onClick={async () => {
          if (!window.confirm(`Delete "${name}" and all ${versions} version${versions === 1 ? "" : "s"}? This can't be undone.`)) return;
          setBusy(true);
          const res = await deleteDesign(designKey).catch((e: Error) => ({ ok: false as const, error: e.message }));
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
