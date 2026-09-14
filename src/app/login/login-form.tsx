"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" | "error"; message?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setState({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setState(error ? { kind: "error", message: error.message } : { kind: "sent" });
  }

  if (state.kind === "sent") {
    return (
      <p data-testid="magic-link-sent" className="prose-serif mt-8">
        Check <strong>{email}</strong> for a sign-in link. It opens this app and signs you in.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4">
      <label className="grid gap-2">
        <span className="label">Email</span>
        <input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="btn btn-primary" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Sending…" : "Email me a magic link"}
      </button>
      {state.kind === "error" && <p className="font-mono text-sm text-bad">{state.message}</p>}
    </form>
  );
}
