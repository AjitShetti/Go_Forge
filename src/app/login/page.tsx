import type { Metadata } from "next";
import { Caption, NotImplemented, Page, PixelHeading } from "@/components/ui";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = getSupabaseConfig() !== null;
  return (
    <Page className="max-w-xl">
      <Caption className="pt-10">FIG_050 · Auth · email magic link</Caption>
      <PixelHeading className="mt-6 text-5xl">Sign in</PixelHeading>
      {error && (
        <p data-testid="auth-error" className="mt-6 border border-bad px-3 py-2 font-mono text-sm text-bad">
          Sign-in failed: {error}
        </p>
      )}
      {configured ? (
        <LoginForm />
      ) : (
        <div className="mt-8 grid gap-4">
          <NotImplemented what="Supabase not configured" />
          <p className="prose-serif text-ink-2">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>, then restart. Until then nothing you do is saved.
          </p>
        </div>
      )}
    </Page>
  );
}
