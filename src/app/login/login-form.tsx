"use client";

import { useEffect, useState } from "react";
import { friendlyAuthError } from "@/lib/auth/auth-errors";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { OAuthProvider } from "@/lib/supabase/providers";

const PROVIDER_LABEL: Record<OAuthProvider, string> = { github: "GitHub", google: "Google" };
/** Supabase refuses a second email to the same address within 60 seconds. */
const RESEND_AFTER_SECONDS = 60;

type State =
  | { kind: "idle" | "sending" }
  | { kind: "error"; message: string }
  | { kind: "sent"; verifying?: boolean; message?: string };

export function LoginForm({ providers = [] }: { providers?: OAuthProvider[] }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendEmail() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setState({ kind: "sending" });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setState({ kind: "error", message: friendlyAuthError(error) });
      } else {
        setCode("");
        setState({ kind: "sent" });
        setResendIn(RESEND_AFTER_SECONDS);
      }
    } catch (err) {
      // Offline or Supabase unreachable: without this the button stays on "Sending…" forever.
      setState({ kind: "error", message: `Could not reach the sign-in service: ${(err as Error).message}` });
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setState({ kind: "sent", verifying: true });
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) {
        setState({ kind: "sent", message: friendlyAuthError(error) });
        return;
      }
      // Full navigation so the server renders with the new session cookie.
      window.location.assign("/track");
    } catch (err) {
      setState({ kind: "sent", message: `Could not reach the sign-in service: ${(err as Error).message}` });
    }
  }

  async function signInWith(provider: OAuthProvider) {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setState({ kind: "error", message: friendlyAuthError(error) });
  }

  if (state.kind === "sent") {
    return (
      <div className="mt-8 grid gap-4">
        <p data-testid="magic-link-sent" className="prose-serif">
          We sent a sign-in email to <strong>{email}</strong>. Open the link in it, or type the code from the email here.
        </p>
        <form onSubmit={verifyCode} className="grid gap-4">
          <label className="grid gap-2">
            <span className="label">Code from the email</span>
            <input
              className="field font-mono tracking-[0.3em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button className="btn btn-primary" disabled={state.verifying || code.length < 6}>
            {state.verifying ? "Checking…" : "Sign in with code"}
          </button>
          {state.message && (
            <p className="font-mono text-sm text-bad" data-testid="login-error">
              {state.message}
            </p>
          )}
        </form>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn" disabled={resendIn > 0} onClick={sendEmail}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend email"}
          </button>
          <button type="button" className="btn" onClick={() => setState({ kind: "idle" })}>
            Use a different email
          </button>
        </div>
        <p className="text-sm text-ink-2">No email after a minute? Check your spam folder.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6">
      {providers.length > 0 && (
        <div className="grid gap-3">
          {providers.map((p) => (
            <button key={p} type="button" className="btn btn-primary" onClick={() => signInWith(p)}>
              Continue with {PROVIDER_LABEL[p]}
            </button>
          ))}
          <p className="label text-center">or use your email</p>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendEmail();
        }}
        className="grid gap-4"
      >
        <label className="grid gap-2">
          <span className="label">Email</span>
          <input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className={providers.length ? "btn" : "btn btn-primary"} disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
        {state.kind === "error" && (
          <p className="font-mono text-sm text-bad" data-testid="login-error">
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
