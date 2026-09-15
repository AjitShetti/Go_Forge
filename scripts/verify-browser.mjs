// End-to-end verification in a real browser (installed Microsoft Edge, headless)
// against a production build served by `next start`.
//   npm run build && npm run verify:browser [-- --only=p1,engine,p2]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { normalizeOutput, runRealGo } from "./real-go.mjs";

const root = resolve(import.meta.dirname, "..");
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "--only=p1,engine,p2").slice(7).split(",");
const shots = join(root, "docs", "evidence", "screens");
mkdirSync(shots, { recursive: true });

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

const profile = mkdtempSync(join(tmpdir(), "goforge-edge-"));
const ctx = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true, viewport: { width: 1360, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && pageErrors.push("console: " + m.text()));
page.on("response", (r) => r.status() >= 400 && pageErrors.push(`HTTP ${r.status()} ${r.url()}`));

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};

export const ctxApi = { page, ctx, check, BASE, shots, runRealGo, normalizeOutput, root };

// ------------------------------------------------------------------- P1 ---
if (only.includes("p1")) {
  console.log("\n== P1 shell ==");
  await page.goto(BASE + "/");
  check("home renders pixel headline", (await page.locator("h1").innerText()).toLowerCase().includes("first principles"));
  const configured = (await page.getByTestId("supabase-status").count()) === 0;
  if (configured) check("Supabase configured: header offers Sign in", await page.getByRole("link", { name: "Sign in" }).isVisible());
  else check("DB not connected badge is visible", await page.getByTestId("supabase-status").isVisible());
  await page.screenshot({ path: join(shots, "p1-home.png"), fullPage: true });

  for (const [label, href] of [["Track", "/track"], ["Review", "/review"], ["Canvas", "/canvas"], ["Notebook", "/notebook"], ["Engine", "/engine"]]) {
    await page.goto(BASE + "/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: label, exact: true }).click();
    await page.waitForURL(BASE + href);
    check(`nav → ${href}`, (await page.locator("h1").innerText()).length > 0);
  }

  await page.goto(BASE + "/track");
  check("track lists 13 modules", (await page.locator("[data-testid^=module-M]").count()) === 13);
  await page.screenshot({ path: join(shots, "p1-track.png"), fullPage: true });

  await page.goto(BASE + "/notebook");
  check("/notebook shows NOT IMPLEMENTED badge", await page.getByTestId("not-implemented").first().isVisible());
  // P5 built the canvas and P6 its grader; the badge must be gone.
  await page.goto(BASE + "/canvas");
  check("/canvas no longer shows a NOT IMPLEMENTED badge", (await page.getByTestId("not-implemented").count()) === 0);
  // P4 replaced the /review placeholder; signed out it gates instead of showing data.
  await page.goto(BASE + "/review");
  check("/review (signed out) shows the sign-in gate", (await page.getByTestId("learner-gate").getAttribute("data-kind")) === (configured ? "signed-out" : "not-configured"));

  await page.goto(BASE + "/login");
  if (configured) {
    check("login shows the magic-link form", await page.getByRole("button", { name: "Email me a magic link" }).isVisible());
    const cb = await fetch(BASE + "/auth/callback?code=not-a-real-code", { redirect: "manual" });
    check("auth callback with a bogus code redirects to /login with an error", cb.status === 307 && (cb.headers.get("location") ?? "").includes("/login?error="), `status=${cb.status} location=${cb.headers.get("location")}`);
  } else {
    check("login states Supabase is not configured", /supabase not configured/i.test(await page.getByTestId("not-implemented").innerText()));
    const cb = await fetch(BASE + "/auth/callback?code=x", { redirect: "manual" });
    check("auth callback without Supabase redirects to /login with error", cb.status === 307 && (cb.headers.get("location") ?? "").includes("/login?error="), `status=${cb.status}`);
  }

  const manifest = await (await fetch(BASE + "/engine/gen/manifest.json")).json();
  const head = await fetch(BASE + "/engine/gen/" + manifest.tools.compile.file, { method: "HEAD" });
  check("hashed engine binaries are served immutable", (head.headers.get("cache-control") ?? "").includes("immutable"), head.headers.get("cache-control") ?? "");
}

// --------------------------------------------------------------- engine ---
if (only.includes("engine")) {
  console.log("\n== Engine page (P0 exit criteria, now inside Next) ==");
  await page.goto(BASE + "/engine");
  await page.waitForFunction(() => window.__coldStartMs !== undefined, null, { timeout: 180000 });
  console.log(`engine cold start: ${await page.evaluate(() => window.__coldStartMs)} ms`);

  async function runExample(name, { lang = "", timeoutMs = 5000 } = {}) {
    await page.selectOption("#example", name);
    await page.selectOption("#lang", lang);
    await page.fill("#timeout", String(timeoutMs));
    await page.evaluate(() => (window.__lastResult = undefined));
    await page.click("#run");
    await page.waitForFunction(() => window.__lastResult !== undefined, null, { timeout: 120000 });
    return page.evaluate(() => ({ ...window.__lastResult, code: document.getElementById("code").value }));
  }

  for (const [name, opts] of [
    ["goroutines + WaitGroup + channel", {}],
    ["panic: index out of range", {}],
    ["deadlock", {}],
    ["loop variable capture (try go1.21)", { lang: "go1.21" }],
    ["compile error", {}],
  ]) {
    const r = await runExample(name, opts);
    const real = runRealGo(r.code, { lang: opts.lang || undefined });
    const same = r.stdout === real.stdout && r.exitCode === real.exitCode && normalizeOutput(r.stderr) === normalizeOutput(real.stderr);
    check(`${name}${opts.lang ? ` [${opts.lang}]` : ""} matches go run`, same, `status=${r.status} total=${r.totalMs}ms`);
  }
  const loop = await runExample("infinite loop (timeout)", { timeoutMs: 2000 });
  check("infinite loop stopped by timeout", loop.status === "timeout");
  const again = await runExample("goroutines + WaitGroup + channel");
  check("engine recovers after timeout", again.stdout === "sum of squares: 55\n");
  await page.screenshot({ path: join(shots, "engine.png"), fullPage: true });
}

// ------------------------------------------------------------------- P2 ---
if (only.includes("p2")) {
  try {
    const { verifyP2 } = await import("./verify-p2-lesson.mjs");
    await verifyP2(ctxApi);
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") console.log("\n(P2 checks not present yet)");
    else throw e;
  }
}

if (only.includes("p2auth")) {
  const { verifyP2Persistence } = await import("./verify-p2-persistence.mjs");
  await verifyP2Persistence(ctxApi);
}

check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 5).join(" | "));
await ctx.close();
server.kill();
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
