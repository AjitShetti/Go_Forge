// P2 persistence checks against the live Supabase project, as the e2e user:
// every transition is stored, reloading resumes the lesson from the event log,
// and the domain rows (predictions, runs, attempts, progress) are correct.
//
// Requires E2E_EMAIL / E2E_PASSWORD in .env.local and a clean slate for that
// user on this lesson (see supabase/e2e-reset.sql).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";

const LESSON = "/track/m3-slices-maps/slice-aliasing";

export function loadEnvLocal(root) {
  const env = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export async function verifyP2Persistence({ page, ctx, check, BASE, root }) {
  console.log("\n== P2 persistence (signed in, live Supabase) ==");
  const env = loadEnvLocal(root);
  if (!env.E2E_EMAIL || !env.E2E_PASSWORD) {
    check("E2E credentials present in .env.local", false);
    return;
  }

  // Sign in exactly the way the app's cookie-based session works.
  const jar = new Map();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
    },
  });
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD });
  check("e2e user signs in", !error && !!auth.user, error?.message);
  if (error) return;
  await new Promise((r) => setTimeout(r, 100));
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" })));

  const { data: lessonRow } = await supabase.from("lessons").select("id").eq("content_ref", "go/m3-slices-maps/slice-aliasing").single();
  const { count: existing } = await supabase.from("lesson_events").select("id", { count: "exact", head: true }).eq("lesson_id", lessonRow.id);
  if (existing > 0) {
    check("e2e user starts this lesson clean (run supabase/e2e-reset.sql)", false, `${existing} events already stored`);
    return;
  }

  const waitSaved = () => page.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.dataset.kind === "saved", null, { timeout: 30000 });
  const activeStep = () => page.locator('[data-testid="stepper"] [data-status="active"]').getAttribute("data-step");

  await page.goto(BASE + LESSON);
  await page.getByTestId("step-provoke").waitFor();
  check("header shows the signed-in email", (await page.getByTestId("user-email").innerText()) === env.E2E_EMAIL);
  check("save status is saved (persistence on)", (await page.getByTestId("save-status").getAttribute("data-kind")) === "saved");

  await page.getByTestId("choice-1").click(); // "42 42": correct
  await page.getByTestId("lock-prediction").click();
  await waitSaved();
  await page.reload();
  await page.getByTestId("step-provoke").waitFor();
  check("after reload, the locked prediction is restored (cannot re-predict)", (await page.getByTestId("lock-prediction").count()) === 0 && (await page.getByTestId("choice-1").getAttribute("aria-checked")) === "true");

  await page.waitForFunction(() => !document.querySelector('[data-testid="run-trap"]')?.disabled, null, { timeout: 180000 });
  await page.getByTestId("run-trap").click();
  await page.getByTestId("verdict").waitFor({ timeout: 120000 });
  check("correct prediction recognised", (await page.getByTestId("verdict").getAttribute("data-correct")) === "true");
  await page.getByTestId("continue").click();
  await page.getByTestId("step-decode").waitFor();
  await waitSaved();

  await page.reload();
  await page.getByTestId("step-decode").waitFor({ timeout: 30000 });
  check("after reload, the lesson resumes at decode", (await activeStep()) === "decode");
  check("after reload, collide result is still shown", (await page.getByTestId("verdict").getAttribute("data-correct")) === "true");

  await page.getByTestId("continue").click();
  await page.waitForFunction(() => window.__goforgeEditors?.rebuild, null, { timeout: 60000 });
  await page.getByTestId("run-rebuild").click();
  await page.getByTestId("rebuild-output").waitFor({ timeout: 120000 });
  await page.getByTestId("continue").click();
  await page.waitForFunction(() => window.__goforgeEditors?.challenge, null, { timeout: 60000 });
  await page.getByTestId("run-tests").click();
  await page.waitForFunction(() => window.__lessonState.attempts === 1, null, { timeout: 120000 });
  await page.getByTestId("give-up").click();
  await page.getByTestId("confirm-give-up").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("skip-stretch").click();
  await page.getByTestId("completion").waitFor();
  await waitSaved();

  await page.reload();
  await page.getByTestId("completion").waitFor({ timeout: 30000 });
  check("after reload, the finished lesson shows 'marked for review'", (await page.getByTestId("completion").getAttribute("data-completed")) === "false");

  // --- rows, read back through RLS as the same user ---
  const q = (table) => supabase.from(table).select("*").eq("lesson_id", lessonRow.id);
  const [{ data: events }, { data: preds }, { data: runs }, { data: attempts }, { data: progress }] = await Promise.all([
    supabase.from("lesson_events").select("event,from_state,to_state").eq("lesson_id", lessonRow.id).order("id"),
    q("predictions"),
    q("runs"),
    q("challenge_attempts"),
    q("lesson_progress"),
  ]);
  const { data: concept } = await supabase.from("concepts").select("id").eq("slug", "append-aliasing").single();
  const seq = events.map((e) => e.event).join(",");
  check(
    "every transition is in lesson_events, in order",
    seq === "PREDICT,TRAP_RUN_STARTED,TRAP_RESULT,CONTINUE,CONTINUE,REBUILD_RUN,CONTINUE,CHALLENGE_RESULT,GIVE_UP,CONTINUE,SKIP_STRETCH",
    seq,
  );
  check("prediction row: text, correct, concept tag", preds.length === 1 && preds[0].text === "42 42" && preds[0].correct === true && preds[0].concept_id === concept.id, JSON.stringify(preds));
  check("runs: one collide, one rebuild, with output", runs.length === 2 && runs.some((r) => r.step === "collide" && r.stdout === "42 42\n") && runs.some((r) => r.step === "rebuild"), JSON.stringify(runs.map((r) => [r.step, r.stdout, r.status])));
  check("challenge attempt: failed, cases recorded", attempts.length === 1 && attempts[0].passed === false && attempts[0].failed_cases.length > 0 && attempts[0].code.includes("return append(s, v)"), JSON.stringify(attempts.map((a) => [a.passed, a.failed_cases])));
  check("lesson_progress: complete state, marked for review, not completed", progress.length === 1 && progress[0].state === "complete" && progress[0].marked_for_review === true && progress[0].completed === false, JSON.stringify(progress));
}
