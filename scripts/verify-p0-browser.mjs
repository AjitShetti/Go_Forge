// P0 exit-criteria check in a real browser (installed Microsoft Edge, headless):
// paste a goroutine + WaitGroup + channel program, run it, and compare stdout /
// stderr / exit code with the local Go toolchain. Also measures cold start
// with an empty cache and with a warm HTTP cache.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { normalizeOutput, runRealGo } from "./real-go.mjs";

const PORT = 4173;
const server = spawn(process.execPath, [join(import.meta.dirname, "serve-static.mjs"), String(PORT)], { stdio: "pipe" });
await new Promise((r) => server.stdout.once("data", r));

const profile = mkdtempSync(join(tmpdir(), "goforge-edge-"));
const ctx = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};

async function openPage() {
  await page.goto(`http://localhost:${PORT}/p0/`);
  await page.waitForFunction(() => window.__coldStartMs !== undefined, null, { timeout: 180000 });
  return page.evaluate(() => window.__coldStartMs);
}

async function runExample(name, { lang = "", timeoutMs = 5000, code } = {}) {
  await page.selectOption("#example", name);
  if (code) await page.fill("#code", code);
  await page.selectOption("#lang", lang);
  await page.fill("#timeout", String(timeoutMs));
  await page.evaluate(() => (window.__lastResult = undefined));
  await page.click("#run");
  await page.waitForFunction(() => window.__lastResult !== undefined, null, { timeout: 120000 });
  return page.evaluate(() => ({ ...window.__lastResult, code: document.getElementById("code").value }));
}

const cold = await openPage();
console.log(`cold start, empty cache: ${cold} ms`);
const warm = await openPage();
console.log(`cold start, warm HTTP cache (page reload): ${warm} ms`);

for (const [name, opts] of [
  ["goroutines + WaitGroup + channel", {}],
  ["panic: index out of range", {}],
  ["panic: nil map write", {}],
  ["deadlock", {}],
  ["loop variable capture (try go1.21)", {}],
  ["loop variable capture (try go1.21)", { lang: "go1.21" }],
  ["compile error", {}],
]) {
  const r = await runExample(name, opts);
  const real = runRealGo(r.code, { lang: opts.lang || undefined });
  const label = `${name}${opts.lang ? ` [${opts.lang}]` : ""}`;
  check(
    label,
    r.stdout === real.stdout && r.exitCode === real.exitCode && normalizeOutput(r.stderr) === normalizeOutput(real.stderr),
    `status=${r.status} exit=${r.exitCode} compile=${r.compileMs}ms link=${r.linkMs}ms run=${r.runMs}ms total=${r.totalMs}ms stdout=${JSON.stringify(r.stdout)} stderr[0]=${JSON.stringify(r.stderr.split("\n")[0])}`,
  );
  if (r.stdout !== real.stdout || normalizeOutput(r.stderr) !== normalizeOutput(real.stderr)) {
    console.log(`      real stdout=${JSON.stringify(real.stdout)} stderr=${JSON.stringify(normalizeOutput(real.stderr))}`);
    console.log(`      page stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(normalizeOutput(r.stderr))}`);
  }
}

const loop = await runExample("infinite loop (timeout)", { timeoutMs: 2000 });
check("infinite loop is stopped by timeout", loop.status === "timeout", `status=${loop.status} total=${loop.totalMs}ms`);
const after = await runExample("goroutines + WaitGroup + channel");
check("engine usable after timeout respawn", after.stdout === "sum of squares: 55\n", `total=${after.totalMs}ms (includes worker respawn)`);

await page.selectOption("#example", "panic: index out of range");
await page.click("#run");
await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("done"));
await page.screenshot({ path: join(import.meta.dirname, "..", "docs", "evidence", "p0-browser.png"), fullPage: true });

check("no uncaught page errors", errors.length === 0, errors.join(" | "));
await ctx.close();
server.kill();
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
console.log(failures === 0 ? "\nP0 browser verification: ALL PASS" : `\nP0 browser verification: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
