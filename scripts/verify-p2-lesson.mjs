// P2 browser checks: the slice-aliasing lesson end to end, driven through the
// real UI in Edge, with the rules of §4 asserted at each step. Called from
// scripts/verify-browser.mjs.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LESSON = "/track/m3-slices-maps/slice-aliasing";

export async function verifyP2({ page, check, BASE, shots, runRealGo, root }, { label = "signed out", expectSaved = false, finish = "pass" } = {}) {
  console.log(`\n== P2 lesson (${label}) ==`);
  const dir = join(root, "content", "go", "m3-slices-maps", "slice-aliasing");
  const read = (...p) => readFileSync(join(dir, ...p), "utf8");
  const setEditor = (id, code) => page.evaluate(([id, code]) => window.__goforgeEditors[id].setValue(code), [id, code]);
  const stateStep = () => page.evaluate(() => window.__lessonState?.step);

  await page.goto(BASE + LESSON);
  await page.getByTestId("step-provoke").waitFor();
  const saveKind = await page.getByTestId("save-status").getAttribute("data-kind");
  check(`save status is ${expectSaved ? "saved" : "not-saved"}`, expectSaved ? saveKind !== "not-saved" : saveKind === "not-saved", `kind=${saveKind}`);

  // --- 1. Provoke: the gate ---
  const run = page.getByTestId("run-trap");
  check("Run is disabled before predicting", await run.isDisabled());
  check("Run button says predict first", /predict first/i.test(await run.innerText()));
  check("Decode is not in the DOM before collide", (await page.getByTestId("step-decode").count()) === 0 && !(await page.content()).includes("A slice isn&#x27;t the array"));
  check("lock-in is disabled with no choice", await page.getByTestId("lock-prediction").isDisabled());

  await page.getByTestId("choice-0").click(); // "99 42": the wrong, Python-shaped answer
  await page.getByTestId("lock-prediction").click();
  check("prediction locks: choices disabled", await page.getByTestId("choice-1").isDisabled());
  await page.waitForFunction(() => !document.querySelector('[data-testid="run-trap"]')?.disabled, null, { timeout: 180000 });

  // --- 2. Collide ---
  await run.click();
  await page.getByTestId("verdict").waitFor({ timeout: 120000 });
  const actual = (await page.getByTestId("collide-actual").innerText()).trim();
  const real = runRealGo(read("trap.go"));
  check("collide shows the real Go output", actual === real.stdout.trim(), `page=${JSON.stringify(actual)} go=${JSON.stringify(real.stdout)}`);
  check("wrong prediction is stated plainly", (await page.getByTestId("verdict").getAttribute("data-correct")) === "false");
  check("no engine divergence warning", (await page.getByTestId("engine-divergence").count()) === 0);
  check("still no explanation at collide", (await page.getByTestId("step-decode").count()) === 0);
  await page.screenshot({ path: join(shots, "p2-collide.png"), fullPage: true });

  // --- 3. Decode ---
  await page.getByTestId("continue").click();
  await page.getByTestId("step-decode").waitFor();
  const decodeText = await page.getByTestId("step-decode").innerText();
  check("decode explains the mechanism", decodeText.includes("backing array") && decodeText.toLowerCase().includes("capacity"));
  check("verified blocks show recorded output", decodeText.includes("true true") && decodeText.includes("99 42 false"));
  await page.getByTestId("contrast").locator("summary").click();
  check("Python/JS contrast expands", (await page.getByTestId("contrast").innerText()).includes("False friend"));
  await page.screenshot({ path: join(shots, "p2-decode.png"), fullPage: true });

  // --- 4. Rebuild ---
  await page.getByTestId("continue").click();
  await page.getByTestId("editor-rebuild").waitFor();
  await page.waitForFunction(() => window.__goforgeEditors?.rebuild, null, { timeout: 60000 });
  const rebuild = read("rebuild.go");
  await setEditor("rebuild", rebuild.replace("c := append(a, 42)", "c := append(a[:3:3], 42)"));
  await page.getByTestId("run-rebuild").click();
  check("editing a locked line blocks the run", await page.getByTestId("lock-violation").isVisible());
  await setEditor("rebuild", read("rebuild", "solution.go"));
  await page.getByTestId("run-rebuild").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="goal-status"]')?.dataset.met === "true", null, { timeout: 120000 });
  check("rebuild goal met with a legal edit", (await page.getByTestId("rebuild-output").innerText()).includes("99 42"));

  // --- 5. Challenge ---
  await page.getByTestId("continue").click();
  await page.getByTestId("editor-challenge").waitFor();
  await page.waitForFunction(() => window.__goforgeEditors?.challenge, null, { timeout: 60000 });
  check("cannot continue from the challenge before passing", (await page.getByTestId("step-challenge").getByTestId("continue").count()) === 0);
  check("hint 1 starts locked", (await page.getByTestId("hint-1").getAttribute("data-state")) === "locked");
  check("solution is not offered before passing", (await page.getByTestId("reveal-solution").count()) === 0);

  const runTests = async () => {
    const prev = await page.evaluate(() => window.__lessonState.attempts);
    await page.getByTestId("run-tests").click();
    await page.waitForFunction((p) => window.__lessonState.attempts > p, prev, { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="run-tests"]')?.disabled, null, { timeout: 30000 });
    return page.getByTestId("test-results").getAttribute("data-passed");
  };
  const attrBecomes = (testId, attr, value) =>
    page
      .waitForFunction(([t, a, v]) => document.querySelector(`[data-testid="${t}"]`)?.getAttribute(a) === v, [testId, attr, value], { timeout: 5000 })
      .then(() => true, () => false);

  check("starter (naive append) fails hidden tests", (await runTests()) === "false");
  const failing = await page.locator('[data-testid="test-case"][data-status="FAIL"]').allInnerTexts();
  check("failed cases are named", failing.some((t) => t.includes("spare_capacity")), failing.join(" | "));
  check("hint 1 still locked after 1 failure", (await page.getByTestId("hint-1").getAttribute("data-state")) === "locked");
  await runTests();
  check("hint 1 unlocks after 2 failures", await attrBecomes("hint-1", "data-state", "available"));
  await page.getByTestId("reveal-hint-1").click();
  check("hint 1 revealed", (await page.getByTestId("hint-1").getAttribute("data-state")) === "revealed");
  check("hint 2 locked with countdown", (await page.getByTestId("hint-2").innerText()).includes("2 more"));

  await setEditor("challenge", "package main\n\nfunc appendCopy(s []int, v int) []int {\n\treturn append(s, v\n}\n");
  const compiled = await runTests();
  check("compile errors are reported, not a pass", compiled === "false" && /does not compile/i.test(await page.getByTestId("test-results").innerText()));
  await page.screenshot({ path: join(shots, "p2-challenge-fail.png"), fullPage: true });

  if (finish === "give-up") {
    await page.getByTestId("give-up").click();
    await page.getByTestId("confirm-give-up").click();
    check("giving up shows the solution", await page.getByTestId("solution").isVisible());
    await page.getByTestId("continue").click();
    await page.getByTestId("skip-stretch").click();
    await page.getByTestId("completion").waitFor();
    check("gave up → marked for review, not complete", (await page.getByTestId("completion").getAttribute("data-completed")) === "false");
    return;
  }

  await setEditor("challenge", read("challenge", "solution.go"));
  const passedAttr = await runTests();
  check("correct solution passes", passedAttr === "true", `data-passed=${passedAttr} results=${(await page.getByTestId("test-results").innerText()).slice(0, 300)}`);
  check("solution unlocks after passing", await page.getByTestId("reveal-solution").isVisible());

  // --- 6. Stretch + complete ---
  await page.getByTestId("continue").click();
  await page.getByTestId("stretch-body").fill("s := []int{1,2,3,4}; t := s[1:3]; t[0] = 9 changes s[1]. copy() or s[1:3:3] with append avoids sharing writes past len.");
  await page.getByTestId("submit-stretch").click();
  await page.getByTestId("completion").waitFor();
  check("lesson complete after pass without solution reveal", (await page.getByTestId("completion").getAttribute("data-completed")) === "true");
  check("machine reached complete", (await stateStep()) === "complete");
  await page.screenshot({ path: join(shots, "p2-complete.png"), fullPage: true });
}
