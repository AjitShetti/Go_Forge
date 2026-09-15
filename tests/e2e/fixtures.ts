import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function loadEnvLocal(): Record<string, string> {
  const file = join(process.cwd(), ".env.local");
  const env: Record<string, string> = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export const env = { ...loadEnvLocal(), ...process.env } as Record<string, string>;
export const hasLearner = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.E2E_EMAIL && env.E2E_PASSWORD);

export const content = (...p: string[]) => readFileSync(join(process.cwd(), "content", ...p), "utf8");

/** Collects uncaught exceptions and console errors so every flow can assert a clean page. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  return errors;
}

type Fixtures = {
  errors: string[];
  /** A Supabase client signed in as the e2e learner, sharing its session with the browser. */
  learner: { db: SupabaseClient; userId: string };
};

export const test = base.extend<Fixtures>({
  errors: async ({ page }, use) => {
    await use(watchErrors(page));
  },
  learner: async ({ context }, use) => {
    test.skip(!hasLearner, "E2E_EMAIL / E2E_PASSWORD / Supabase env not set in .env.local");
    const jar = new Map<string, string>();
    const db = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cs) => cs.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
      },
    });
    const { data, error } = await db.auth.signInWithPassword({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD });
    if (error || !data.user) throw new Error(`e2e learner cannot sign in: ${error?.message}`);
    await new Promise((r) => setTimeout(r, 100)); // setAll runs after the promise resolves
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" as const })));
    await use({ db: db as unknown as SupabaseClient, userId: data.user.id });
  },
});

export { expect };

/** Types into a Monaco editor through the hook code-editor.tsx exposes for tests. */
export async function setEditor(page: Page, id: string, code: string) {
  // Monaco mounts asynchronously after its step opens.
  await page.waitForFunction((id) => (window as unknown as { __goforgeEditors?: Record<string, unknown> }).__goforgeEditors?.[id], id, { timeout: 30_000 });
  await page.evaluate(([id, code]) => (window as unknown as { __goforgeEditors: Record<string, { setValue(v: string): void }> }).__goforgeEditors[id].setValue(code), [id, code]);
}

export const lessonState = (page: Page) => page.evaluate(() => (window as unknown as { __lessonState?: Record<string, unknown> }).__lessonState);

/** Fails fast with instructions when an earlier run left rows behind for a concept this flow asserts on. */
export async function requireCleanConcept(db: SupabaseClient, slug: string) {
  const { data: concept } = await db.from("concepts").select("id").eq("slug", slug).single();
  const { count } = await db.from("predictions").select("id", { count: "exact", head: true }).eq("concept_id", concept!.id);
  if ((count ?? 0) > 0) throw new Error(`the e2e learner already has "${slug}" predictions: run supabase/e2e-reset.sql first`);
}

/** Fails if the page scrolls sideways. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${page.url()} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}
