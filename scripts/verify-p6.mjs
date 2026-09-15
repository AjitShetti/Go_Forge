// P6 end-to-end check: scenario pages, the Grade button and the report in a
// real browser (installed Edge, headless) against a production build. Signed
// out first (grade shown, not recorded), then signed in as the e2e user
// against live Supabase (grade recorded in design_reviews, shown after
// reload). Cleans up the design it creates; needs no reset.
//
//   npm run build && node scripts/verify-p6.mjs
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright-core";
import { loadEnvLocal } from "./verify-p2-persistence.mjs";

const root = resolve(import.meta.dirname, "..");
const PORT = 3510;
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

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "goforge-edge-")), { channel: "msedge", headless: true, viewport: { width: 1440, height: 1000 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && pageErrors.push(`console: ${m.text()}`));
page.on("dialog", (d) => d.accept());

const state = () => page.evaluate(() => window.__designState);
const waitState = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 });
const report = () => page.getByTestId("grade-report");
const reportData = async () => ({
  score: Number(await report().getAttribute("data-score")),
  passed: (await report().getAttribute("data-passed")) === "true",
  violations: Number(await page.getByTestId("grade-violations").getAttribute("data-count")),
  warnings: Number(await page.getByTestId("grade-warnings").getAttribute("data-count")),
  tradeoffs: Number(await page.getByTestId("grade-tradeoffs").getAttribute("data-count")),
  record: await page.getByTestId("grade-record").getAttribute("data-kind"),
});
let designKey = null;
let supabase = null;

try {
  // ============================================================ signed out ===
  console.log("== P6 signed out ==");
  await page.goto(BASE + "/scenarios");
  check("/scenarios lists the ticketing flash sale", (await page.getByTestId("scenario-list").textContent()).includes("Event ticketing: flash sale"));
  await page.goto(BASE + "/scenarios/ticketing-flash-sale");
  check("scenario page states constraints with their rules", (await page.getByTestId("scenario-constraints").textContent()).includes("admission-queue"));
  await page.screenshot({ path: join(shots, "p6-scenario.png"), fullPage: true });
  check("unknown scenario is a 404", (await page.goto(BASE + "/scenarios/nope")).status() === 404);
  pageErrors.length = 0; // the 404 above logs a console error on purpose

  await page.goto(BASE + "/canvas/new");
  check("Grade is disabled until a scenario is picked", await page.getByTestId("grade-design").isDisabled());
  check("no NOT IMPLEMENTED badge left on the canvas", (await page.getByTestId("not-implemented").count()) === 0);

  await page.goto(BASE + "/scenarios/ticketing-flash-sale");
  await page.getByTestId("start-naive").click();
  await page.waitForURL(/start=naive/);
  await waitState(() => window.__designState?.graph.nodes.length === 3);
  check("naive start opens with the scenario selected", (await state()).scenario === "ticketing-flash-sale");
  await page.getByTestId("grade-design").click();
  await report().waitFor();
  let r = await reportData();
  check("naive design: score 35, failed, 4 violations, 1 warning", r.score === 35 && !r.passed && r.violations === 4 && r.warnings === 1, JSON.stringify(r));
  check("signed out: grade is not recorded", r.record === "not-recorded", r.record);
  const capacity = await page.locator('[data-testid="finding"][data-rule="capacity"]').textContent();
  check("capacity finding shows its arithmetic", capacity.includes("capacity = 1 replica × 2,000 rps = 2,000 rps") && capacity.includes("short by 198,000 rps"), capacity);
  check("score arithmetic is shown", (await page.getByTestId("score-math").textContent()).includes("4 violations × −15"));
  await page.locator('[data-testid="finding"][data-rule="capacity"]').getByText("show on canvas").click();
  await page.waitForFunction(() => document.querySelector('.react-flow__node[data-id="app"]')?.classList.contains("selected"), null, { timeout: 5000 });
  check("'show on canvas' selects the offending node", true);
  await page.screenshot({ path: join(shots, "p6-report-naive.png"), fullPage: true });

  // Live regrade: fix the app's capacity in the inspector; the open report follows.
  await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
  await page.locator('.react-flow__node[data-id="app"]').click();
  const replicasInput = page.getByTestId("inspector-replicas");
  await replicasInput.fill("200");
  await replicasInput.blur();
  await page.waitForFunction(() => !document.querySelector('[data-testid="finding"][data-rule="capacity"]'), null, { timeout: 10000 });
  r = await reportData();
  check("editing replicas regrades live: capacity + app SPOF gone (2 violations left)", r.violations === 2, JSON.stringify(r));

  await page.goto(BASE + "/canvas/new?scenario=ticketing-flash-sale&start=reference");
  await waitState(() => window.__designState?.graph.nodes.length === 12);
  await page.getByTestId("grade-design").click();
  await report().waitFor();
  r = await reportData();
  check("reference design: 100, passed, 0 violations, 0 warnings, 4 tradeoffs", r.score === 100 && r.passed && r.violations === 0 && r.warnings === 0 && r.tradeoffs === 4, JSON.stringify(r));
  await page.screenshot({ path: join(shots, "p6-report-reference.png"), fullPage: true });

  // ============================================================= signed in ===
  console.log("\n== P6 signed in (live Supabase, e2e user) ==");
  const env = loadEnvLocal(root);
  const jar = new Map();
  supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))) },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD });
  check("e2e user signs in", !error, error?.message);
  if (error) throw new Error("cannot continue signed-in checks");
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" })));

  await page.goto(BASE + "/canvas/new?scenario=ticketing-flash-sale&start=naive");
  await waitState(() => window.__designState?.graph.nodes.length === 3);
  await page.getByTestId("design-name").fill("P6 verify naive");
  await page.getByTestId("grade-design").click();
  await report().waitFor();
  check("unsaved design: grade shown but not recorded", (await reportData()).record === "not-recorded");
  await page.getByTestId("save-design").click();
  await page.waitForURL(/\/canvas\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await waitState(() => window.__designState?.status === "saved");
  designKey = (await state()).designKey;
  const { data: row } = await supabase.from("designs").select("id, scenario_id, scenarios(slug)").eq("design_key", designKey).single();
  check("saved version points at the scenario row", row?.scenarios?.slug === "ticketing-flash-sale", JSON.stringify(row));

  await page.getByTestId("grade-design").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="grade-record"]')?.getAttribute("data-kind") === "recorded", null, { timeout: 30000 });
  check("saved design: grade recorded", true);
  const { data: reviews } = await supabase.from("design_reviews").select("score, violations, warnings").eq("design_id", row.id);
  check(
    "design_reviews row matches the report (35, 4 violations, 1 warning + tradeoffs)",
    reviews?.length === 1 && reviews[0].score === 35 && reviews[0].violations.length === 4 && reviews[0].warnings.filter((f) => f.severity === "warning").length === 1,
    JSON.stringify(reviews?.map((x) => ({ score: x.score, v: x.violations.length, w: x.warnings.length }))),
  );

  await page.reload();
  await page.getByTestId("last-review").waitFor();
  check("after reload the last recorded grade is shown", (await page.getByTestId("last-review").textContent()).includes("35"));
  check("after reload the scenario is still selected", (await state()).scenario === "ticketing-flash-sale");

  await page.getByTestId("grade-design").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="grade-record"]')?.getAttribute("data-kind") === "recorded", null, { timeout: 30000 });
  await page.getByTestId("design-scenario").selectOption("");
  check("changing the scenario marks the design dirty", (await state()).dirty === true);
  await page.getByTestId("design-scenario").selectOption("ticketing-flash-sale");
  check("changing it back is clean again", (await state()).dirty === false);

  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: anonRows } = await anon.from("design_reviews").select("id");
  check("anon can't read design reviews", (anonRows ?? []).length === 0);
  const { data: scen } = await anon.from("scenarios").select("slug");
  check("scenarios are readable content", (scen ?? []).some((s) => s.slug === "ticketing-flash-sale"));

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/scenarios", "/scenarios/ticketing-flash-sale"]) {
    await page.goto(BASE + path);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(`${path} has no sideways scroll at 390px`, sw <= iw + 1, `scrollWidth=${sw} innerWidth=${iw}`);
  }

  check("no page errors", pageErrors.length === 0, pageErrors.join("\n"));
} catch (e) {
  check("run completed", false, `${e.stack ?? e}\n--- page errors ---\n${pageErrors.join("\n")}\n--- server log (tail) ---\n${serverLog.slice(-3000)}`);
} finally {
  if (designKey && supabase) {
    const { data } = await supabase.from("designs").delete().eq("design_key", designKey).select("id");
    console.log(`cleanup: deleted ${data?.length ?? 0} design row(s)`);
  }
  await ctx.close();
  server.kill();
}
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
