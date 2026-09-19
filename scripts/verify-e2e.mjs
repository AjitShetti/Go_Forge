// Whole-app end-to-end run (P0–P4) in real Edge (headless) against a production
// build, as a learner would use it, with the edge cases the per-milestone
// scripts don't cover:
//
//   A  public surface: routes, 404s, auth callback abuse, login form failures
//   B  engine: forbidden imports, exit codes, output flood, recovery, engine that can't load
//   C  signed in: a full P3 lesson (integer-division) with every gate pushed on,
//      reload mid-challenge, and the stored rows checked
//   D  review + mastery: learning → mastered → demoted by a wrong answer → mastered
//   E  a concept with a single review card: "Next question" still gives a fresh form
//   F  RLS attacks with the learner's own session, and as anon
//   G  signed-in /login, sign out, and what signed-out pages then show
//   H  phone width: no page scrolls sideways
//
//   npm run build && node scripts/verify-e2e.mjs
//
// Needs E2E_EMAIL / E2E_PASSWORD in .env.local and a reset e2e user (supabase/e2e-reset.sql).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright-core";
import { normalizeForCompare, observedOutput, parseLessonMd } from "../src/lib/content/lesson.ts";
import { normalizeOutput, runRealGo } from "./real-go.mjs";
import { loadEnvLocal } from "./verify-p2-persistence.mjs";

const root = resolve(import.meta.dirname, "..");
const PORT = 3300;
const BASE = `http://localhost:${PORT}`;
const env = loadEnvLocal(root);

let failures = 0;
let section = "";
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail && !ok ? "\n      " + String(detail).slice(0, 1500) : ""}`);
};
const heading = (s) => console.log(`\n== ${(section = s)} ==`);

// ------------------------------------------------------------------ server ---
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

const profile = mkdtempSync(join(tmpdir(), "goforge-e2e-"));
const ctx = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true, viewport: { width: 1360, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const pageErrors = [];
let expectErrors = false; // set while a check deliberately provokes a 404 or a blocked request
page.on("pageerror", (e) => pageErrors.push(`[${section}] ${e}`));
page.on("console", (m) => m.type() === "error" && !expectErrors && pageErrors.push(`[${section}] console: ${m.text()}`));

const content = (ref, ...p) => readFileSync(join(root, "content", ref, ...p), "utf8");
const setEditor = (id, code) => page.evaluate(([id, code]) => window.__goforgeEditors[id].setValue(code), [id, code]);
const lessonState = () => page.evaluate(() => window.__lessonState);
const waitSaved = () => page.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.dataset.kind === "saved", null, { timeout: 30000 });
const waitAttempts = (n) => page.waitForFunction((n) => window.__lessonState?.attempts === n, n, { timeout: 150000 });

try {
  // ================================================================== A ====
  heading("A · public surface and auth (signed out)");
  for (const path of ["/", "/track", "/review", "/dashboard", "/canvas", "/notebook", "/engine", "/login", "/track/m1-types-values-memory/integer-division"]) {
    const r = await fetch(BASE + path);
    check(`GET ${path} → 200`, r.status === 200, `status=${r.status}`);
  }
  for (const path of ["/track/m4-structs-methods/not-a-lesson", "/track/nope/nope", "/track/..%2F..%2Fpackage.json/x", "/review/not-a-concept", "/definitely-not-a-page"]) {
    const r = await fetch(BASE + path);
    check(`GET ${path} → 404 (unknown lesson or traversal)`, r.status === 404, `status=${r.status}`);
  }
  const loc = async (path) => {
    const r = await fetch(BASE + path, { redirect: "manual" });
    return { status: r.status, location: r.headers.get("location") ?? "" };
  };
  {
    const a = await loc("/auth/callback");
    check("callback with no code → back to /login with an error", a.status === 307 && a.location.startsWith(`${BASE}/login?error=`), JSON.stringify(a));
    const b = await loc("/auth/callback?token_hash=bogus&type=magiclink");
    check("callback with a bogus token hash → /login error", b.status === 307 && b.location.startsWith(`${BASE}/login?error=`), JSON.stringify(b));
    const c = await loc("/auth/callback?code=bogus&next=//evil.example");
    check("callback never redirects off-site, even with next=//evil.example", c.location.startsWith(BASE + "/"), JSON.stringify(c));
    const s = await fetch(BASE + "/auth/signout", { redirect: "manual" });
    check("GET /auth/signout is not a way to sign someone out (405)", s.status === 405, `status=${s.status}`);
  }

  await page.goto(BASE + "/login?error=" + encodeURIComponent('<img src=x onerror="window.__xss=1">'));
  check("login error text is escaped, not injected", (await page.locator("img[src=x]").count()) === 0 && (await page.getByTestId("auth-error").innerText()).includes("<img"));
  check("no script ran from the error parameter", (await page.evaluate(() => window.__xss)) === undefined);

  await page.locator('input[type="email"]').fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  check("invalid email is blocked by the form, nothing is sent", (await page.getByTestId("magic-link-sent").count()) === 0 && (await page.locator("input:invalid").count()) === 1);

  // Supabase unreachable: the form must report it, not hang on "Sending…". No email is sent.
  expectErrors = true;
  await page.route("**/auth/v1/otp**", (r) => r.abort("internetdisconnected"));
  await page.locator('input[type="email"]').fill("nobody@goforge.test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByTestId("login-error").waitFor({ timeout: 15000 }).catch(() => {});
  check("login form reports an unreachable auth service", (await page.getByTestId("login-error").count()) === 1, await page.locator("form").innerText());
  check("login button is usable again after the failure", await page.getByRole("button", { name: "Email me a sign-in link" }).isEnabled());
  await page.unroute("**/auth/v1/otp**");
  expectErrors = false;

  // ================================================================== B ====
  heading("B · engine edge cases");
  await page.goto(BASE + "/engine");
  await page.waitForFunction(() => window.__coldStartMs !== undefined, null, { timeout: 180000 });
  const runCode = async (code, timeoutMs = 5000) => {
    await page.fill("#code", code);
    await page.fill("#timeout", String(timeoutMs));
    await page.evaluate(() => (window.__lastResult = undefined));
    await page.click("#run");
    await page.waitForFunction(() => window.__lastResult !== undefined, null, { timeout: 150000 });
    return page.evaluate(() => window.__lastResult);
  };
  {
    const r = await runCode(`package main\n\nimport "syscall/js"\n\nfunc main() { js.Global().Call("alert", "hi") }\n`);
    check("importing syscall/js is refused at compile time", r.status === "compile_error" && r.stderr.includes("syscall/js"), JSON.stringify(r));

    const exitSrc = `package main\n\nimport (\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\tfmt.Println("before")\n\tfmt.Fprintln(os.Stderr, "bad thing")\n\tos.Exit(3)\n}\n`;
    const e = await runCode(exitSrc);
    const real = runRealGo(exitSrc);
    check("os.Exit(3) with stdout+stderr matches go run", e.exitCode === real.exitCode && e.stdout === real.stdout && normalizeOutput(e.stderr) === normalizeOutput(real.stderr), JSON.stringify({ e, real }));

    const errSrc = `package main\n\nimport "errors"\n\nfunc main() { panic(errors.New("custom")) }\n`;
    const p = await runCode(errSrc);
    const realP = runRealGo(errSrc);
    check("panic(error) matches go run", p.exitCode === realP.exitCode && normalizeOutput(p.stderr) === normalizeOutput(realP.stderr), JSON.stringify({ p: p.stderr, real: realP.stderr }));

    const u = await runCode(`package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("héllo, 世界 🚀") }\n`);
    check("UTF-8 output survives chunking", u.stdout === "héllo, 世界 🚀\n", JSON.stringify(u.stdout));

    const flood = await runCode(`package main\n\nimport "fmt"\n\nfunc main() {\n\tfor {\n\t\tfmt.Println("spam spam spam spam spam spam spam spam")\n\t}\n}\n`, 20000);
    check("output flood is cut off by the 1 MiB cap", flood.status === "output_limit", `status=${flood.status}`);
    const after = await runCode(`package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("alive") }\n`);
    check("engine recovers after the output cap killed it", after.stdout === "alive\n" && after.status === "ok", JSON.stringify(after));

    const empty = await runCode("");
    check("empty file is a compile error, not an engine crash", empty.status === "compile_error", JSON.stringify(empty));
  }

  // An engine whose binaries can't be fetched: the lesson must say so and never pretend to run.
  {
    const p2 = await ctx.newPage();
    const p2Errors = [];
    p2.on("pageerror", (e) => p2Errors.push(String(e)));
    await p2.route(/\/engine\/gen\/.*\.(wasm|pack)$/, (r) => r.abort("failed"));
    await p2.goto(BASE + "/track/m1-types-values-memory/integer-division");
    await p2.getByTestId("engine-error").waitFor({ timeout: 60000 }).catch(() => {});
    check("engine that fails to load shows an error banner in the lesson", (await p2.getByTestId("engine-error").count()) === 1);
    await p2.getByTestId("choice-0").click();
    await p2.getByTestId("lock-prediction").click();
    check("…and Run stays disabled instead of hanging", await p2.getByTestId("run-trap").isDisabled());
    check("…with no uncaught exceptions", p2Errors.length === 0, p2Errors.join("\n"));
    await p2.close();
  }

  // ================================================================== C ====
  heading("C · signed in: full integer-division lesson with edge cases");
  const jar = new Map();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
    },
  });
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD });
  check("e2e user signs in", !authErr && !!auth.user, authErr?.message);
  if (authErr) throw new Error("cannot continue signed in");
  const me = auth.user.id;
  await new Promise((r) => setTimeout(r, 100));
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" })));

  const REF = "go/m1-types-values-memory/integer-division";
  const LESSON_URL = BASE + "/track/m1-types-values-memory/integer-division";
  const { data: lessonRow } = await supabase.from("lessons").select("id").eq("content_ref", REF).single();
  const { data: conceptRow } = await supabase.from("concepts").select("id").eq("slug", "integer-division").single();
  const { count: dirty } = await supabase.from("predictions").select("id", { count: "exact", head: true }).in("concept_id", [conceptRow.id]);
  if (dirty > 0) throw new Error("e2e user already has integer-division predictions: run supabase/e2e-reset.sql first");

  const lessonMd = parseLessonMd(content(REF, "lesson.md"));
  const expected = JSON.parse(content(REF, "expected.json"));
  const trap = lessonMd.frontmatter.trap;
  const wrongChoice = trap.choices.findIndex((c, i) => i !== trap.answer);

  await page.goto(LESSON_URL);
  await page.getByTestId("step-provoke").waitFor();
  check("header shows the signed-in email", (await page.getByTestId("user-email").innerText()) === env.E2E_EMAIL);
  await waitSaved();

  // Prediction gate.
  check("Run is disabled before any prediction", await page.getByTestId("run-trap").isDisabled());
  check("Lock is disabled until a choice is picked", await page.getByTestId("lock-prediction").isDisabled());
  check("Decode is not in the DOM before collide", (await page.getByTestId("step-decode").count()) === 0 && !(await page.locator("main").innerText()).includes("Every line here is integer arithmetic"));
  await page.getByTestId(`choice-${wrongChoice}`).click();
  await page.getByTestId("lock-prediction").click();
  await page.getByTestId(`choice-${trap.answer}`).click({ force: true }).catch(() => {});
  check("a locked prediction cannot be changed by clicking another choice", (await page.getByTestId(`choice-${wrongChoice}`).getAttribute("aria-checked")) === "true" && (await page.getByTestId(`choice-${trap.answer}`).getAttribute("aria-checked")) === "false");

  await page.waitForFunction(() => !document.querySelector('[data-testid="run-trap"]')?.disabled, null, { timeout: 180000 });
  await page.getByTestId("run-trap").dblclick(); // a double click must not run (or record) the trap twice
  await page.getByTestId("verdict").waitFor({ timeout: 120000 });
  check("wrong prediction → Mismatch", (await page.getByTestId("verdict").getAttribute("data-correct")) === "false");
  check("collide shows what Go really printed (matches verified output)", normalizeForCompare(await page.getByTestId("collide-actual").innerText()) === observedOutput(expected.blocks.trap.real));
  check("no engine-divergence warning", (await page.getByTestId("engine-divergence").count()) === 0);
  await page.getByTestId("continue").click();
  await page.getByTestId("step-decode").waitFor();
  await page.getByTestId("continue").click();

  // Rebuild: locked lines are enforced; the original doesn't meet the goal; the fix does.
  await page.waitForFunction(() => window.__goforgeEditors?.rebuild, null, { timeout: 60000 });
  const rebuildSrc = content(REF, "rebuild.go");
  await setEditor("rebuild", rebuildSrc.replace("total := 7", "total := 7.0"));
  await page.getByTestId("run-rebuild").click();
  check("editing a locked line is refused and not run", await page.getByTestId("lock-violation").isVisible());
  await setEditor("rebuild", rebuildSrc);
  await page.getByTestId("run-rebuild").click();
  await page.waitForFunction(() => window.__lessonState?.rebuildRuns === 1, null, { timeout: 120000 });
  check("original rebuild program does not meet the goal", (await page.getByTestId("goal-status").getAttribute("data-met")) === "false");
  await setEditor("rebuild", content(REF, "rebuild", "solution.go"));
  await page.getByTestId("run-rebuild").click();
  await page.waitForFunction(() => window.__lessonState?.rebuildRuns === 2, null, { timeout: 120000 });
  check("fixed rebuild program meets the goal", (await page.getByTestId("goal-status").getAttribute("data-met")) === "true");
  await page.getByTestId("continue").click();

  // Challenge: compile error, wrong answer, infinite loop, then hints, reload, pass.
  await page.waitForFunction(() => window.__goforgeEditors?.challenge, null, { timeout: 60000 });
  check("can't skip the challenge: no Continue before passing or giving up", (await page.locator('[data-testid="step-challenge"] [data-testid="continue"]').count()) === 0);
  check("hint 1 locked at 0 failures", (await page.getByTestId("hint-1").getAttribute("data-state")) === "locked");
  await setEditor("challenge", "package main\n\nfunc FloorDiv(a, b int) int {\n\treturn a /\n}\n");
  await page.getByTestId("run-tests").click();
  await waitAttempts(1);
  check("compile error counts as a failed attempt and shows the diagnostic", (await page.getByTestId("test-results").innerText()).toLowerCase().includes("does not compile"));

  await setEditor("challenge", content(REF, "challenge", "starter.go"));
  await page.getByTestId("run-tests").click();
  await waitAttempts(2);
  check("starter fails with named failing cases", (await page.locator('[data-testid="test-case"][data-status="FAIL"]').count()) > 0);
  check("hint 1 unlocks after 2 failures", (await page.getByTestId("hint-1").getAttribute("data-state")) === "available");
  check("hint 2 still locked", (await page.getByTestId("hint-2").getAttribute("data-state")) === "locked");

  await setEditor("challenge", "package main\n\nfunc FloorDiv(a, b int) int {\n\tfor {\n\t}\n}\n\nfunc FloorMod(a, b int) int { return 0 }\n");
  await page.getByTestId("run-tests").click();
  await waitAttempts(3);
  check("an infinite loop in the learner's code is stopped and reported", /did not finish \(timeout\)/i.test(await page.getByTestId("test-results").innerText()) && (await page.getByTestId("timeout-note").isVisible()), await page.getByTestId("test-results").innerText());

  await page.getByTestId("reveal-hint-1").click();
  check("hint 1 revealed", (await page.getByTestId("hint-1").getAttribute("data-state")) === "revealed");
  check("solution is not reachable before passing (only 'I give up' offered)", (await page.getByTestId("reveal-solution").count()) === 0 && (await page.getByTestId("solution").count()) === 0);
  await waitSaved();

  await page.reload();
  await page.waitForFunction(() => window.__lessonState?.step === "challenge", null, { timeout: 30000 });
  {
    const s = await lessonState();
    check("reload mid-challenge resumes: 3 attempts, 3 failed, 1 hint used", s.attempts === 3 && s.failedAttempts === 3 && s.hintsRevealed === 1, JSON.stringify(s));
    check("after reload the collide verdict is still a mismatch", (await page.getByTestId("verdict").getAttribute("data-correct")) === "false");
  }
  await page.waitForFunction(() => window.__goforgeEditors?.challenge && !document.querySelector('[data-testid="run-tests"]')?.disabled, null, { timeout: 180000 });
  await setEditor("challenge", content(REF, "challenge", "solution.go"));
  await page.getByTestId("run-tests").click();
  await waitAttempts(4);
  check("reference solution passes", await page.getByTestId("challenge-passed").isVisible());
  check("the engine restarted after the timeout and still ran the tests", (await page.getByTestId("test-results").getAttribute("data-passed")) === "true");
  check("give up is no longer offered after passing", (await page.getByTestId("give-up").count()) === 0);
  await page.getByTestId("reveal-solution").click();
  check("solution can be viewed after passing", await page.getByTestId("solution").isVisible());
  await page.getByTestId("continue").click();

  // Stretch: blank answers are refused.
  await page.getByTestId("stretch-body").fill("   \n ");
  check("blank stretch answer can't be submitted", await page.getByTestId("submit-stretch").isDisabled());
  await page.getByTestId("stretch-body").fill("Floor vs truncation only differs for negative quotients with a remainder.");
  await page.getByTestId("submit-stretch").click();
  await page.getByTestId("completion").waitFor();
  check("lesson completes (passed, never gave up)", (await page.getByTestId("completion").getAttribute("data-completed")) === "true");
  await waitSaved();

  {
    const [{ data: events }, { data: preds }, { data: attempts }, { data: progress }, { data: notes }, { data: runs }] = await Promise.all([
      supabase.from("lesson_events").select("event").eq("lesson_id", lessonRow.id).order("id"),
      supabase.from("predictions").select("*").eq("lesson_id", lessonRow.id),
      supabase.from("challenge_attempts").select("passed, hints_used, solution_revealed, failed_cases").eq("lesson_id", lessonRow.id).order("created_at"),
      supabase.from("lesson_progress").select("*").eq("lesson_id", lessonRow.id),
      supabase.from("notebook").select("*").eq("lesson_id", lessonRow.id),
      supabase.from("runs").select("step").eq("lesson_id", lessonRow.id),
    ]);
    const seq = events.map((e) => e.event).join(",");
    check(
      "event log: one trap run despite the double click, no event for the refused rebuild run",
      seq === "PREDICT,TRAP_RUN_STARTED,TRAP_RESULT,CONTINUE,CONTINUE,REBUILD_RUN,REBUILD_RUN,CONTINUE,CHALLENGE_RESULT,CHALLENGE_RESULT,CHALLENGE_RESULT,REVEAL_HINT,CHALLENGE_RESULT,REVEAL_SOLUTION,CONTINUE,SUBMIT_STRETCH",
      seq,
    );
    check("one wrong trap prediction stored with the concept tag", preds.length === 1 && preds[0].correct === false && preds[0].concept_id === conceptRow.id && preds[0].source === "trap" && preds[0].text === trap.choices[wrongChoice], JSON.stringify(preds));
    check(
      "attempts: compile error, fail, timeout, then a clean pass with 1 hint and no solution shown",
      attempts.length === 4 &&
        attempts[0].failed_cases.includes("(compile error)") &&
        attempts.slice(0, 3).every((a) => !a.passed) &&
        attempts[3].passed && attempts[3].hints_used === 1 && attempts[3].solution_revealed === false,
      JSON.stringify(attempts),
    );
    check("runs: 1 collide + 2 rebuild (refused run not stored)", runs.filter((r) => r.step === "collide").length === 1 && runs.filter((r) => r.step === "rebuild").length === 2, JSON.stringify(runs));
    check("progress: completed, not marked for review", progress.length === 1 && progress[0].completed === true && progress[0].marked_for_review === false, JSON.stringify(progress));
    check("stretch answer saved to the notebook", notes.length === 1 && notes[0].body?.includes("Floor vs truncation"), JSON.stringify(notes));
  }

  // ================================================================== D ====
  heading("D · review and mastery for integer-division");
  const answerFor = (cardId, correct, choices) => {
    const blockId = cardId.split("#")[1];
    if (blockId === "trap") {
      const right = trap.choices[trap.answer];
      return correct ? right : trap.choices.find((c) => c !== right);
    }
    const real = expected.blocks[blockId].real;
    const out = normalizeForCompare(real.stdout);
    let answer;
    if (!choices) answer = out;
    else if (real.exitCode === 0) answer = "Compiles and runs normally";
    else if (real.exitCode === 1) answer = "Does not compile";
    else if (real.stderr.startsWith("fatal error: all goroutines are asleep")) answer = "Compiles, then deadlocks";
    else answer = "Compiles, then panics at run time";
    if (correct) return answer;
    return choices ? choices.find((c) => c !== answer) : "this is not the output";
  };
  const answerCard = async (correct) => {
    const card = page.getByTestId("review-card");
    await card.waitFor();
    const id = await card.getAttribute("data-card");
    const choiceCount = await page.locator('[data-testid^="choice-"]').count();
    const choices = choiceCount ? await page.locator('[data-testid^="choice-"]').evaluateAll((els) => els.map((e) => e.textContent)) : null;
    const answer = answerFor(id, correct, choices);
    if (choices) await page.getByTestId(`choice-${choices.indexOf(answer)}`).click();
    else await page.getByTestId("answer-text").fill(answer);
    await page.getByTestId("submit-answer").click();
    await page.locator('[data-testid="review-result"], [data-testid="answer-error"]').first().waitFor({ timeout: 30000 });
    if (await page.getByTestId("answer-error").count()) throw new Error("review answer error: " + (await page.getByTestId("answer-error").innerText()));
    return { id, graded: (await page.getByTestId("review-result").getAttribute("data-correct")) === "true", seenBefore: (await card.innerText()).toLowerCase().includes("seen before") };
  };
  const conceptStatus = async () => {
    await page.goto(BASE + "/review/integer-division");
    return page.getByTestId("concept-state").locator("[data-status]").getAttribute("data-status");
  };

  await page.goto(BASE + "/review");
  check("integer-division is scheduled after the lesson (not due yet)", (await page.getByTestId("upcoming-integer-division").count()) === 1 && (await page.getByTestId("due-integer-division").count()) === 0);
  check("the wrong trap prediction is in the mistake ledger", (await page.getByTestId("mistake-ledger").innerText()).includes("lesson trap"));
  check("status before any review: learning", (await conceptStatus()) === "learning");
  check("missing condition named: a new question right on the first try", (await page.getByTestId("mastery-missing").innerText()).includes("new question"));
  {
    const html = await page.content();
    const cardId = await page.getByTestId("review-card").getAttribute("data-card");
    const blockId = cardId.split("#")[1];
    const secret = blockId === "trap" ? null : normalizeForCompare(expected.blocks[blockId].real.stdout || expected.blocks[blockId].real.stderr);
    check("the review answer is not shipped to the browser before answering", secret === null || secret === "" || !html.includes(secret), `card ${cardId}`);
    check("Lock in answer disabled while empty", await page.getByTestId("submit-answer").isDisabled());
    if (await page.getByTestId("answer-text").count()) {
      await page.getByTestId("answer-text").fill("   ");
      check("whitespace-only answer can't be submitted", await page.getByTestId("submit-answer").isDisabled());
    }
  }

  const r1 = await answerCard(true);
  check(`review 1 (${r1.id.split("#")[1]}): correct first try is graded a match`, r1.graded && !r1.seenBefore);
  check("MASTERED: later correct first try + clean challenge pass", (await conceptStatus()) === "mastered");
  {
    const { data: m } = await supabase.from("mastery").select("state").eq("concept_id", conceptRow.id).single();
    check("mastery cache row says mastered", m?.state === "mastered", JSON.stringify(m));
  }

  await page.getByTestId("review-card").waitFor();
  const r2 = await answerCard(false);
  check(`review 2 (${r2.id.split("#")[1]}): a different card, wrong answer graded a mismatch`, r2.id !== r1.id && !r2.graded);
  const demoted = await conceptStatus();
  check("DEMOTED: a newer wrong answer takes mastery away", demoted !== "mastered", demoted);

  const r3 = await answerCard(true);
  check(`review 3 (${r3.id.split("#")[1]}): a third, different card`, r3.id !== r1.id && r3.id !== r2.id && r3.graded);
  if (r3.id.endsWith("#trap")) check("the trap card is flagged 'seen before' (it was answered in the lesson)", r3.seenBefore);
  check("RE-MASTERED once the latest answer is right again", (await conceptStatus()) === "mastered");

  await page.goto(BASE + "/dashboard");
  {
    // Derived from the content on disk, so adding lessons doesn't break this check.
    const trackJson = JSON.parse(readFileSync(join(root, "content", "go", "track.json"), "utf8"));
    const authoredCount = trackJson.modules.flatMap((m) => m.lessons.map((l) => join(root, "content", "go", m.slug, l.slug, "lesson.md"))).filter((p) => existsSync(p)).length;
    check(`dashboard: 1 lesson completed of ${authoredCount} authored`, (await page.getByTestId("fact-lessons-completed").innerText()).includes(`1 of ${authoredCount}`), await page.getByTestId("fact-lessons-completed").innerText());
  }
  check("dashboard: 1 clean challenge pass", (await page.getByTestId("fact-clean-passes").innerText()).trim().endsWith("1"));
  check("dashboard: integer-division chip mastered", (await page.getByTestId("concept-integer-division").locator("[data-status]").getAttribute("data-status")) === "mastered");
  check("dashboard: lesson row says completed", (await page.getByTestId("lesson-integer-division").getAttribute("data-status")) === "completed");

  // ================================================================== E ====
  heading("E · concept with a single review card (toolchain)");
  await page.goto(BASE + "/review/toolchain");
  const onlyCard = await page.getByTestId("review-card").getAttribute("data-card");
  await page.getByTestId("choice-0").click();
  await page.getByTestId("submit-answer").click();
  await page.getByTestId("review-result").waitFor({ timeout: 30000 });
  await page.getByTestId("next-card").click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="review-result"]') && document.querySelector('[data-testid="submit-answer"]'), null, { timeout: 30000 }).catch(() => {});
  check("'Next question' on a one-card concept gives a fresh, unanswered form", (await page.getByTestId("review-result").count()) === 0 && (await page.getByTestId("submit-answer").count()) === 1);
  check("…for the same card, now flagged 'seen before'", (await page.getByTestId("review-card").getAttribute("data-card")) === onlyCard && (await page.getByTestId("review-card").innerText()).toLowerCase().includes("seen before"));

  // ================================================================== F ====
  heading("F · row-level security attacks");
  {
    const stranger = "00000000-0000-4000-8000-000000000001";
    const ins = await supabase.from("predictions").insert({ user_id: stranger, lesson_id: lessonRow.id, concept_id: conceptRow.id, text: "x", correct: true });
    check("can't insert a prediction as another user", !!ins.error, JSON.stringify(ins));

    const { data: before } = await supabase.from("predictions").select("id, correct").eq("lesson_id", lessonRow.id).eq("source", "trap").single();
    await supabase.from("predictions").update({ correct: true }).eq("id", before.id);
    const { data: afterUpd } = await supabase.from("predictions").select("correct").eq("id", before.id).single();
    check("can't rewrite history: a wrong prediction can't be flipped to correct", afterUpd.correct === false);

    const { count: evBefore } = await supabase.from("lesson_events").select("id", { count: "exact", head: true }).eq("lesson_id", lessonRow.id);
    await supabase.from("lesson_events").delete().eq("lesson_id", lessonRow.id);
    await supabase.from("challenge_attempts").delete().eq("lesson_id", lessonRow.id);
    const { count: evAfter } = await supabase.from("lesson_events").select("id", { count: "exact", head: true }).eq("lesson_id", lessonRow.id);
    const { count: atAfter } = await supabase.from("challenge_attempts").select("id", { count: "exact", head: true }).eq("lesson_id", lessonRow.id);
    check("can't delete the event log or attempts", evBefore === evAfter && atAfter === 4, `${evBefore}→${evAfter}, attempts ${atAfter}`);

    const lessonWrite = await supabase.from("lessons").update({ title: "pwned" }).eq("id", lessonRow.id).select();
    const { data: lessonNow } = await supabase.from("lessons").select("title").eq("id", lessonRow.id).single();
    check("can't edit curriculum content", lessonNow.title !== "pwned" && (lessonWrite.error || (lessonWrite.data ?? []).length === 0), JSON.stringify(lessonWrite));

    for (const table of ["predictions", "runs", "challenge_attempts", "lesson_events", "mastery", "notebook", "lesson_progress", "profiles"]) {
      const { data, error } = await supabase.from(table).select(table === "profiles" ? "id" : "user_id");
      const ids = new Set((data ?? []).map((r) => r.user_id ?? r.id));
      check(`${table}: a learner only ever sees their own rows`, !error && [...ids].every((id) => id === me), error?.message ?? [...ids].join(","));
    }

    const rpc = await supabase.rpc("handle_new_user");
    check("trigger function isn't callable over the API", !!rpc.error);

    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const anonPreds = await anon.from("predictions").select("id");
    check("anon sees no learner data", (anonPreds.data ?? []).length === 0, JSON.stringify(anonPreds));
    const anonIns = await anon.from("predictions").insert({ user_id: me, lesson_id: lessonRow.id, text: "x", correct: true });
    check("anon can't write learner data", !!anonIns.error);
    const anonLessons = await anon.from("lessons").select("id").limit(1);
    check("anon can still read the curriculum", !anonLessons.error && anonLessons.data.length === 1);
  }

  // ================================================================== G ====
  heading("G · signed-in /login, sign out");
  {
    const r = await page.goto(BASE + "/login");
    check("visiting /login while signed in redirects to /track", page.url() === BASE + "/track" && r.ok(), page.url());
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(BASE + "/");
    check("sign out lands on home with a Sign in link", await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sign in" }).isVisible());
    await page.goto(BASE + "/review");
    check("after sign out /review shows the gate, not the old data", (await page.getByTestId("learner-gate").getAttribute("data-kind")) === "signed-out" && (await page.getByTestId("mistake-ledger").count()) === 0);
    await page.goto(BASE + "/dashboard");
    check("after sign out /dashboard shows the gate", (await page.getByTestId("learner-gate").getAttribute("data-kind")) === "signed-out");
    await page.goto(LESSON_URL);
    await page.getByTestId("step-provoke").waitFor();
    check("after sign out a lesson starts fresh and says NOT SAVED", (await page.getByTestId("save-status").getAttribute("data-kind")) === "not-saved" && (await lessonState()).prediction === null);
  }

  // ================================================================== H ====
  heading("H · phone width (390 px)");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/track", "/login", "/review", "/dashboard", "/engine", "/track/m1-types-values-memory/integer-division", "/track/m3-slices-maps/slice-aliasing"]) {
    await page.goto(BASE + path);
    await page.waitForLoadState("networkidle").catch(() => {});
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check(`${path} has no sideways scroll at 390px`, sw <= iw + 1, `scrollWidth=${sw} innerWidth=${iw}`);
  }

  check("no uncaught page errors anywhere", pageErrors.length === 0, pageErrors.join("\n"));
} catch (e) {
  check(`run completed (stopped in: ${section})`, false, `${e.stack ?? e}\n--- page errors ---\n${pageErrors.join("\n")}\n--- server log (tail) ---\n${serverLog.slice(-3000)}`);
} finally {
  await ctx.close();
  server.kill();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
