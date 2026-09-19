import type { Metadata } from "next";
import { Caption, NotImplemented, Page, DisplayHeading } from "@/components/ui";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getEnabledOAuthProviders } from "@/lib/supabase/providers";
import { getCurrentUser } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = getSupabaseConfig() !== null;
  // Already signed in: there is nothing to do here.
  if (configured && (await getCurrentUser())) redirect("/track");
  const providers = configured ? await getEnabledOAuthProviders() : [];
  return (
    <Page className="max-w-xl">
      <Caption className="pt-10">Sign in · no password needed</Caption>
      <DisplayHeading className="mt-6 text-5xl">Sign in</DisplayHeading>
      {error && (
        <p data-testid="auth-error" className="mt-6 border border-bad px-3 py-2 font-mono text-sm text-bad">
          Sign-in failed: {error}
        </p>
      )}
      {configured ? (
        <LoginForm providers={providers} />
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
