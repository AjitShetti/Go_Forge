// P4 end-to-end check in a real browser (installed Edge, headless) against a
// production build, signed out and then signed in as the e2e user against the
// live Supabase project.
//
//   npm run build && node scripts/verify-p4.mjs
//
// Needs E2E_EMAIL / E2E_PASSWORD in .env.local, and no review answers yet for
// the e2e user on the nil-map concept (reset: supabase/e2e-reset.sql).
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright-core";
import { loadEnvLocal } from "./verify-p2-persistence.mjs";

const root = resolve(import.meta.dirname, "..");
const PORT = 3200;
const BASE = `http://localhost:${PORT}`;
const shots = join(root, "docs", "evidence", "screens");
mkdirSync(shots, { recursive: true });

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail && !ok ? "\n      " + detail : ""}`);
};

const server = spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)], { cwd: root, stdio: "pipe" });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {}
  if (i > 120) throw new Error("next start did not come up:\n" + serverLog);
  await new Promise((r) => setTimeout(r, 500));
}

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "goforge-edge-")), { channel: "msedge", headless: true, viewport: { width: 1360, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && pageErrors.push("console: " + m.text()));

try {
  // ------------------------------------------------------------ signed out ---
  console.log("\n== P4 signed out ==");
  for (const path of ["/review", "/dashboard", "/review/nil-map"]) {
    await page.goto(BASE + path);
    check(`${path} shows the sign-in gate, not data`, (await page.getByTestId("learner-gate").getAttribute("data-kind")) === "signed-out");
  }
  check("unknown concept is a 404", (await page.goto(BASE + "/review/not-a-concept")).status() === 404);
  await page.goto(BASE + "/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Progress", exact: true }).click();
  await page.waitForURL(BASE + "/dashboard");
  check("nav → /dashboard", (await page.locator("h1").innerText()).toLowerCase().includes("progress"));

  pageErrors.length = 0; // the 404 above is intended

  // ------------------------------------------------------------- signed in ---
  console.log("\n== P4 signed in (live Supabase, e2e user) ==");
  const env = loadEnvLocal(root);
  const jar = new Map();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
    },
  });
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD });
  check("e2e user signs in", !error && !!auth.user, error?.message);
  if (error) throw new Error("cannot continue signed-in checks");
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" })));

  const { data: nilMap } = await supabase.from("concepts").select("id").eq("slug", "nil-map").single();
  const { count: before } = await supabase.from("predictions").select("id", { count: "exact", head: true }).eq("concept_id", nilMap.id);
  if (before > 0) {
    check("e2e user has no nil-map predictions yet (run supabase/e2e-reset.sql)", false, `${before} rows exist`);
    throw new Error("not a clean slate");
  }

  await page.goto(BASE + "/review");
  check("/review renders the queue for the signed-in user", await page.getByTestId("review-summary").isVisible());
  await page.screenshot({ path: join(shots, "p4-review-before.png"), fullPage: true });

  // Card 1: an output card, answered wrong.
  await page.goto(BASE + "/review/nil-map");
  const card1 = page.getByTestId("review-card");
  check("first card is the unseen Decode program nil-slice-vs-nil-map", (await card1.getAttribute("data-card")) === "go/m3-slices-maps/nil-maps#nil-slice-vs-nil-map");
  const html = await page.content();
  check("the verified answer is not in the page before answering", !html.includes("[1] 0 false 0 true"));
  check("prediction gate: submit is disabled before an answer", await page.getByTestId("submit-answer").isDisabled());
  await page.getByTestId("answer-text").fill("[1] 0 false 0 false");
  await page.getByTestId("submit-answer").click();
  await page.locator('[data-testid="review-result"], [data-testid="answer-error"]').first().waitFor({ timeout: 30000 });
  if (await page.getByTestId("answer-error").count()) throw new Error(`server action error: ${await page.getByTestId("answer-error").innerText()}`);
  check("wrong answer is graded as a mismatch", (await page.getByTestId("review-result").getAttribute("data-correct")) === "false");
  check("real output is revealed after committing", (await page.getByTestId("review-result").innerText()).includes("[1] 0 false 0 true"));
  await page.screenshot({ path: join(shots, "p4-review-card-wrong.png"), fullPage: true });

  // Card 2: the next unseen program, answered right.
  await page.getByTestId("next-card").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="review-card"]')?.getAttribute("data-card")?.endsWith("#map-is-a-pointer"), null, { timeout: 30000 });
  check("next question is a different, unseen program", true);
  await page.getByTestId("answer-text").fill("map[a:1] 8\n");
  await page.getByTestId("submit-answer").click();
  await page.getByTestId("review-result").waitFor();
  check("correct answer (trailing newline ignored) is a match", (await page.getByTestId("review-result").getAttribute("data-correct")) === "true");

  // Card 3: the lesson's trap, a choice card.
  await page.getByTestId("next-card").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="review-card"]')?.getAttribute("data-card")?.endsWith("#trap"), null, { timeout: 30000 });
  await page.getByTestId("choice-1").click();
  await page.getByTestId("submit-answer").click();
  await page.getByTestId("review-result").waitFor();
  check("trap choice card graded correct", (await page.getByTestId("review-result").getAttribute("data-correct")) === "true");

  // Database rows written under RLS.
  const { data: preds } = await supabase.from("predictions").select("source, correct, text").eq("concept_id", nilMap.id).order("created_at");
  check(
    "three review predictions stored with sources and grades",
    JSON.stringify(preds.map((p) => [p.source, p.correct])) ===
      JSON.stringify([
        ["review:go/m3-slices-maps/nil-maps#nil-slice-vs-nil-map", false],
        ["review:go/m3-slices-maps/nil-maps#map-is-a-pointer", true],
        ["review:go/m3-slices-maps/nil-maps#trap", true],
      ]),
    JSON.stringify(preds),
  );

  // Derived state: wrong, right, right → streak 2 ("review"); a later first try was
  // correct, but no nil-maps challenge was passed, so not mastered.
  await page.goto(BASE + "/review/nil-map");
  check("concept page shows status review", (await page.getByTestId("concept-state").locator("[data-status]").getAttribute("data-status")) === "review");
  check("concept page names the missing mastery condition", (await page.getByTestId("mastery-missing").innerText()).includes("pass a challenge"));
  const { data: mastery } = await supabase.from("mastery").select("state, streak, error_count, interval_days").eq("concept_id", nilMap.id).single();
  check("mastery cache row matches the derived state", mastery?.state === "review" && mastery.streak === 2 && mastery.error_count === 1 && mastery.interval_days === 3, JSON.stringify(mastery));

  await page.goto(BASE + "/review");
  check("nil-map is scheduled, not due, after two correct answers", (await page.getByTestId("upcoming-nil-map").count()) === 1 && (await page.getByTestId("due-nil-map").count()) === 0);
  check("the review mistake is in the ledger", (await page.getByTestId("mistake-ledger").innerText()).includes("[1] 0 false 0 false"));
  await page.screenshot({ path: join(shots, "p4-review-after.png"), fullPage: true });

  await page.goto(BASE + "/dashboard");
  check("dashboard shows progress facts", await page.getByTestId("fact-lessons-completed").isVisible());
  check("dashboard concept chip for nil-map says review", (await page.getByTestId("concept-nil-map").locator("[data-status]").getAttribute("data-status")) === "review");
  check("dashboard lists all 13 modules", (await page.locator('[data-testid^="progress-M"]').count()) === 13);
  await page.screenshot({ path: join(shots, "p4-dashboard.png"), fullPage: true });

  check("no page errors", pageErrors.length === 0, pageErrors.join("\n"));
} catch (e) {
  check("run completed", false, `${e}\n--- page errors ---\n${pageErrors.join("\n")}\n--- server log (tail) ---\n${serverLog.slice(-3000)}`);
} finally {
  await ctx.close();
  server.kill();
}
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
