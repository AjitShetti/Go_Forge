// P7 end-to-end check: every lesson authored in P7 (M4–M12), played through in
// a real browser (installed Edge, headless) against a production build, signed
// out, with the real in-browser engine. It touches no database.
//
//   npm run build && node scripts/verify-p7.mjs [slug-filter...]
//
// For each lesson: the right choice runs and matches the verified output,
// Decode renders (run-locally and shell blocks labelled), the reference
// rebuild meets the goal, the reference solution passes the hidden tests, and
// the lesson completes. Lessons whose requires include features the engine
// lacks must show the run-locally banner and track badge; others must not.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { normalizeForCompare, observedOutput, parseLessonMd } from "../src/lib/content/lesson.ts";
import { localOnlyFeatures } from "../src/lib/engine/features.ts";

const root = resolve(import.meta.dirname, "..");
const PORT = 3400;
const BASE = `http://localhost:${PORT}`;
const shots = join(root, "docs", "evidence", "screens");
mkdirSync(shots, { recursive: true });
const filters = process.argv.slice(2);

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail && !ok ? "\n      " + detail : ""}`);
};

const track = JSON.parse(readFileSync(join(root, "content", "go", "track.json"), "utf8"));
const P7_MODULES = track.modules.slice(4); // M4–M12
const lessons = P7_MODULES.flatMap((m) => m.lessons.map((l) => ({ module: m.slug, ...l }))).filter((l) => !filters.length || filters.some((f) => l.slug.includes(f)));

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

const read = (l, ...p) => readFileSync(join(root, "content", "go", l.module, l.slug, ...p), "utf8");
const setEditor = (id, code) => page.evaluate(([id, code]) => window.__goforgeEditors[id].setValue(code), [id, code]);

try {
  console.log(`\n== P7 track page ==`);
  await page.goto(BASE + "/track");
  for (const l of lessons) {
    const local = localOnlyFeatures(l.requires).length > 0;
    const badges = await page.getByTestId(`local-badge-${l.slug}`).count();
    check(`${l.slug}: track ${local ? "shows" : "has no"} run-locally badge`, badges === (local ? 1 : 0));
    check(`${l.slug}: listed as authored (a link)`, (await page.locator(`a[href="/track/${l.module}/${l.slug}"]`).count()) === 1);
  }

  for (const l of lessons) {
    console.log(`\n== ${l.module}/${l.slug} ==`);
    const t0 = Date.now();
    const lesson = parseLessonMd(read(l, "lesson.md"));
    const expected = JSON.parse(read(l, "expected.json"));
    const fm = lesson.frontmatter;
    pageErrors.length = 0;

    const res = await page.goto(`${BASE}/track/${l.module}/${l.slug}`);
    check("page loads", res.status() === 200, `status ${res.status()}`);
    await page.getByTestId("step-provoke").waitFor();
    const local = localOnlyFeatures(fm.requires);
    const banner = page.getByTestId("local-banner");
    if (local.length) check(`run-locally banner lists ${local.join(", ")}`, (await banner.getAttribute("data-features")) === local.join(","));
    else check("no run-locally banner", (await banner.count()) === 0);

    // Provoke → Collide with the verified answer.
    if (fm.trap.kind === "choice") await page.getByTestId(`choice-${fm.trap.answer}`).click();
    else await page.getByTestId("prediction-text").fill(String(fm.trap.answer));
    await page.getByTestId("lock-prediction").click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="run-trap"]')?.disabled, null, { timeout: 240000 });
    await page.getByTestId("run-trap").click();
    await page.getByTestId("verdict").waitFor({ timeout: 120000 });
    check("the verified answer is judged correct", (await page.getByTestId("verdict").getAttribute("data-correct")) === "true");
    check("collide output matches the verified output", normalizeForCompare(await page.getByTestId("collide-actual").innerText()) === observedOutput(expected.blocks.trap.real));
    check("no engine-divergence warning", (await page.getByTestId("engine-divergence").count()) === 0);
    await page.getByTestId("continue").click();

    // Decode.
    await page.getByTestId("step-decode").waitFor();
    const localFences = lesson.fences.filter((f) => f.lang === "go" && f.meta.verified && f.meta.mode === "local");
    for (const f of localFences) {
      const block = page.getByTestId(`local-block-${f.meta.id}`);
      check(`local block ${f.meta.id} is labelled run locally, with recorded output`, (await block.count()) === 1 && /run locally/i.test(await block.innerText()) && (await block.innerText()).includes(expected.blocks[f.meta.id].real.stdout.split("\n")[0]));
    }
    const shellFences = lesson.fences.filter((f) => f.lang === "shell").length;
    if (shellFences) check(`${shellFences} shell block(s) say output not shown`, (await page.getByTestId("shell-block").count()) === shellFences && /output not shown/i.test(await page.getByTestId("shell-block").first().innerText()));
    check("no unverified-block marker", !(await page.locator("main").innerText()).includes("UNVERIFIED BLOCK"));
    if (l.slug === "benchmarks-fuzzing" || l.slug === "kv-store") await page.screenshot({ path: join(shots, `p7-${l.slug}-decode.png`), fullPage: true });
    await page.getByTestId("continue").click();

    // Rebuild with the reference fix.
    await page.waitForFunction(() => window.__goforgeEditors?.rebuild, null, { timeout: 60000 });
    await setEditor("rebuild", read(l, "rebuild", "solution.go"));
    await page.getByTestId("run-rebuild").click();
    await page.waitForFunction(() => window.__lessonState?.rebuildRuns === 1, null, { timeout: 180000 });
    check("reference rebuild meets the goal", (await page.getByTestId("goal-status").getAttribute("data-met")) === "true");
    await page.getByTestId("continue").click();

    // Challenge with the reference solution.
    await page.waitForFunction(() => window.__goforgeEditors?.challenge && !document.querySelector('[data-testid="run-tests"]')?.disabled, null, { timeout: 180000 });
    await setEditor("challenge", read(l, "challenge", "solution.go"));
    await page.getByTestId("run-tests").click();
    await page.waitForFunction(() => window.__lessonState?.attempts === 1, null, { timeout: 240000 });
    const passed = await page.getByTestId("challenge-passed").isVisible();
    check("reference solution passes the hidden tests in the browser", passed, passed ? "" : (await page.getByTestId("test-results").innerText()).slice(0, 800));
    if (!passed) continue;
    await page.getByTestId("continue").click();

    await page.getByTestId("stretch-body").fill("verify-p7 automated run");
    await page.getByTestId("submit-stretch").click();
    await page.getByTestId("completion").waitFor();
    check("lesson completes", (await page.getByTestId("completion").getAttribute("data-completed")) === "true");
    check("no page errors", pageErrors.length === 0, pageErrors.join("\n"));
    console.log(`      (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
} catch (e) {
  check("run completed", false, `${e.stack ?? e}\n--- page errors ---\n${pageErrors.join("\n")}\n--- server log (tail) ---\n${serverLog.slice(-2000)}`);
} finally {
  await ctx.close();
  server.kill();
}
console.log(failures === 0 ? `\nALL PASS (${lessons.length} lessons)` : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
