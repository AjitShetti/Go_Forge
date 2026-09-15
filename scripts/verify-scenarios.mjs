// P7 scenario check: all six scenarios in a real browser (installed Edge,
// headless) against a production build. Signed out: every scenario page, its
// constraint rules, and the grade of both starting designs. Live Supabase: the
// scenarios table matches src/lib/grader/scenarios.ts, and a design saved
// against a P7 scenario records its grade. Cleans up the design it creates.
//
//   npm run build && node scripts/verify-scenarios.mjs
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright-core";
import { loadEnvLocal } from "./verify-p2-persistence.mjs";

const root = resolve(import.meta.dirname, "..");
const { SCENARIOS } = await import("../src/lib/grader/scenarios.ts");
const PORT = 3410;
const BASE = `http://localhost:${PORT}`;
const shots = join(root, "docs", "evidence", "screens");
mkdirSync(shots, { recursive: true });

// Same numbers as tests/unit/grader/scenarios.test.ts EXPECTED.
const EXPECTED = {
  "ticketing-flash-sale": { nodes: [3, 12], naive: { score: 35, violations: 4, warnings: 1 }, tradeoffs: 4 },
  "url-shortener": { nodes: [3, 6], naive: { score: 50, violations: 3, warnings: 1 }, tradeoffs: 1 },
  "news-feed-fanout": { nodes: [3, 8], naive: { score: 35, violations: 4, warnings: 1 }, tradeoffs: 2 },
  "rate-limited-public-api": { nodes: [5, 6], naive: { score: 55, violations: 3, warnings: 0 }, tradeoffs: 1 },
  "file-storage-cdn": { nodes: [5, 8], naive: { score: 20, violations: 5, warnings: 1 }, tradeoffs: 2 },
  "chat-presence": { nodes: [3, 9], naive: { score: 25, violations: 5, warnings: 0 }, tradeoffs: 1 },
};

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
const report = () => page.getByTestId("grade-report");
const reportData = async () => ({
  score: Number(await report().getAttribute("data-score")),
  passed: (await report().getAttribute("data-passed")) === "true",
  violations: Number(await page.getByTestId("grade-violations").getAttribute("data-count")),
  warnings: Number(await page.getByTestId("grade-warnings").getAttribute("data-count")),
  tradeoffs: Number(await page.getByTestId("grade-tradeoffs").getAttribute("data-count")),
  record: await page.getByTestId("grade-record").getAttribute("data-kind"),
});
const openStart = async (slug, start, nodes) => {
  await page.goto(`${BASE}/canvas/new?scenario=${slug}&start=${start}`);
  await page.waitForFunction((n) => window.__designState?.graph.nodes.length === n, nodes, { timeout: 30000 });
  await page.getByTestId("grade-design").click();
  await report().waitFor();
  return reportData();
};
let designKey = null;
let supabase = null;

try {
  console.log("== Scenarios signed out ==");
  await page.goto(BASE + "/scenarios");
  const listText = await page.getByTestId("scenario-list").textContent();
  check("/scenarios lists all six scenarios", SCENARIOS.every((s) => listText.includes(s.title)) && (await page.getByTestId("scenario-list").locator("li").count()) === 6);
  check("the 'scheduled for P7' note is gone", !(await page.content()).includes("scheduled for P7"));

  for (const s of SCENARIOS) {
    const exp = EXPECTED[s.slug];
    await page.goto(`${BASE}/scenarios/${s.slug}`);
    const constraints = await page.getByTestId("scenario-constraints").textContent();
    const cited = [...new Set(s.constraints.flatMap((c) => c.rules))];
    check(`${s.slug}: page shows ${s.constraints.length} constraints and a description for each of its ${cited.length} rules`, s.constraints.every((c) => constraints.includes(c.text)) && cited.every((r) => constraints.includes(r)) && !constraints.includes("undefined"));
    if (s.slug !== "ticketing-flash-sale") await page.screenshot({ path: join(shots, `p7-scenario-${s.slug}.png`), fullPage: true });

    let r = await openStart(s.slug, "naive", exp.nodes[0]);
    check(`${s.slug}: naive design scores ${exp.naive.score} with ${exp.naive.violations} violations and ${exp.naive.warnings} warnings`, r.score === exp.naive.score && !r.passed && r.violations === exp.naive.violations && r.warnings === exp.naive.warnings, JSON.stringify(r));
    const math = await page.locator('[data-testid="finding"]').allTextContents();
    check(`${s.slug}: every violation and warning shows a number`, math.length > 0 && math.every((t) => /\d/.test(t)));
    if (s.slug !== "ticketing-flash-sale") await page.screenshot({ path: join(shots, `p7-report-${s.slug}-naive.png`), fullPage: true });

    r = await openStart(s.slug, "reference", exp.nodes[1]);
    check(`${s.slug}: reference scores 100 with ${exp.tradeoffs} tradeoff(s) and no violations or warnings`, r.score === 100 && r.passed && r.violations === 0 && r.warnings === 0 && r.tradeoffs === exp.tradeoffs, JSON.stringify(r));
  }

  // One P7 rule end to end: break the file-storage reference in the inspector and watch the open report follow.
  await openStart("file-storage-cdn", "reference", 8);
  await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
  await page.locator('.react-flow__node[data-id="objects"]').click();
  const storage = page.getByTestId("inspector-storageGb");
  await storage.fill("10000");
  await storage.blur();
  await page.waitForFunction(() => document.querySelector('[data-testid="finding"][data-rule="storage-capacity"]'), null, { timeout: 10000 });
  const storageText = await page.locator('[data-testid="finding"][data-rule="storage-capacity"]').textContent();
  check("editing storage regrades live: storage-capacity cites the shortfall", storageText.includes("short by 10,990,000 GB"), storageText);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const s of SCENARIOS.slice(1)) {
    await page.goto(`${BASE}/scenarios/${s.slug}`);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(`/scenarios/${s.slug} has no sideways scroll at 390px`, sw <= iw + 1, `scrollWidth=${sw} innerWidth=${iw}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  console.log("\n== Live Supabase ==");
  const env = loadEnvLocal(root);
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: rows, error: rowsError } = await anon.from("scenarios").select("slug, title, requirements, constraints, rules");
  check("scenarios table is readable", !rowsError, rowsError?.message);
  const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  for (const s of SCENARIOS) {
    const row = (rows ?? []).find((x) => x.slug === s.slug);
    check(
      `live row for ${s.slug} matches the TypeScript scenario`,
      row && row.title === s.title && canon(row.requirements) === canon({ summary: s.summary, functional: s.functional, scale: s.scale, params: s.params }) && canon(row.constraints) === canon(s.constraints) && canon(row.rules) === canon(s.rules),
    );
  }

  const jar = new Map();
  supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))) },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD });
  check("e2e user signs in", !error, error?.message);
  if (error) throw new Error("cannot continue signed-in checks");
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" })));

  await page.goto(BASE + "/canvas/new?scenario=chat-presence&start=naive");
  await page.waitForFunction(() => window.__designState?.graph.nodes.length === 3, null, { timeout: 30000 });
  await page.getByTestId("design-name").fill("P7 verify chat naive");
  await page.getByTestId("save-design").click();
  await page.waitForURL(/\/canvas\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await page.waitForFunction(() => window.__designState?.status === "saved", null, { timeout: 30000 });
  designKey = (await state()).designKey;
  const { data: row } = await supabase.from("designs").select("id, scenarios(slug)").eq("design_key", designKey).single();
  check("a design saved against chat-presence points at its scenario row", row?.scenarios?.slug === "chat-presence", JSON.stringify(row));
  await page.getByTestId("grade-design").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="grade-record"]')?.getAttribute("data-kind") === "recorded", null, { timeout: 30000 });
  const { data: reviews } = await supabase.from("design_reviews").select("score, violations").eq("design_id", row.id);
  check(
    "the recorded review has the server-computed grade (25, 5 violations incl. presence-store)",
    reviews?.length === 1 && reviews[0].score === 25 && reviews[0].violations.length === 5 && reviews[0].violations.some((f) => f.rule === "presence-store"),
    JSON.stringify(reviews?.map((x) => ({ score: x.score, v: x.violations.map((f) => f.rule) }))),
  );

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
