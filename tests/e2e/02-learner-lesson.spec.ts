import { content, expect, lessonState, requireCleanConcept, setEditor, test } from "./fixtures";

// A signed-in learner works through one whole lesson the way a person would:
// predicts wrong, reads the decode, rebuilds, fails the challenge, passes it,
// writes a stretch answer, then finds the mistake in review, the lesson on the
// progress page and the stretch answer in the notebook.
//
// Lesson: M6 defer-timing (concept defer-evaluation). No other suite touches it.

const DIR = ["go", "m6-errors", "defer-timing"];
const read = (...p: string[]) => content(...DIR, ...p);
const trap = (JSON.parse(read("lesson.md").split("---")[1]) as { trap: { choices: string[]; answer: number } }).trap;
const STRETCH = "defer f(x) copies x into the deferred call record right away.\nA closure keeps a reference instead.";

test("a whole lesson, then review, progress and notebook agree", async ({ page, errors, learner }) => {
  test.slow();
  await requireCleanConcept(learner.db, "defer-evaluation");

  // ---------------------------------------------------------------- provoke
  await page.goto("/track/m6-errors/defer-timing");
  await expect(page.getByTestId("user-email")).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-kind", "saved");
  await expect(page.getByTestId("run-trap"), "Run stays locked until a prediction is made").toBeDisabled();
  await expect(page.getByTestId("step-decode"), "the explanation is not in the page before predicting").toHaveCount(0);

  const wrong = trap.choices.findIndex((_, i) => i !== trap.answer);
  await page.getByTestId(`choice-${wrong}`).click();
  await page.getByTestId("lock-prediction").click();
  await expect(page.getByTestId("run-trap")).toBeEnabled({ timeout: 120_000 }); // engine download on first use
  await page.getByTestId("run-trap").click();

  // ---------------------------------------------------------------- collide
  await expect(page.getByTestId("verdict")).toContainText(/mismatch/i, { timeout: 60_000 });
  await expect(page.getByTestId("step-collide")).toContainText("deferred arg: 1");

  // ----------------------------------------------------------------- decode
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("step-decode")).toBeVisible();
  await page.getByTestId("continue").click();

  // ---------------------------------------------------------------- rebuild
  await expect(page.getByTestId("goal-status")).toContainText(/not met/i);
  await setEditor(page, "rebuild", read("rebuild", "solution.go"));
  await page.getByTestId("run-rebuild").click();
  await expect(page.getByTestId("goal-status")).toContainText(/goal met/i, { timeout: 60_000 });
  await page.getByTestId("continue").click();

  // -------------------------------------------------------------- challenge
  const runTests = async (code: string, attempts: number) => {
    await setEditor(page, "challenge", code);
    await page.getByTestId("run-tests").click();
    await expect.poll(async () => (await lessonState(page))?.attempts, { timeout: 150_000 }).toBe(attempts);
  };
  await runTests(read("challenge", "wrong", "close-at-end.go"), 1);
  await expect(page.getByTestId("test-results")).toContainText("FAIL");
  await runTests(read("challenge", "wrong", "close-overwrites.go"), 2);
  await expect(page.getByTestId("hint-1"), "hint 1 unlocks after 2 failures").toHaveAttribute("data-state", "available");
  await runTests(read("challenge", "solution.go"), 3);
  await expect(page.getByTestId("challenge-passed")).toBeVisible();
  await expect(page.getByTestId("hint-1")).toContainText("not used");
  await page.getByTestId("continue").click();

  // ---------------------------------------------------------------- stretch
  await page.getByTestId("stretch-body").fill(STRETCH);
  await page.getByTestId("submit-stretch").click();
  await expect(page.getByTestId("completion")).toHaveAttribute("data-completed", "true");
  await expect(page.getByTestId("step-complete")).toContainText("3 attempts · 0 hints · passed");
  await expect(page.getByTestId("next-lesson")).toHaveAttribute("href", "/track/m6-errors/panic-recover");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-kind", "saved");

  // A reload resumes at the end instead of starting over.
  await page.reload();
  await expect(page.getByTestId("completion")).toBeVisible({ timeout: 60_000 });

  // ----------------------------------------------------------------- review
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Review", exact: true }).click();
  await expect(page.getByTestId("mistake-ledger")).toContainText("defer-evaluation");
  await page.goto("/review/defer-evaluation");
  const card = page.getByTestId("review-card");
  await expect(card).toBeVisible();
  const choice = card.locator('[data-testid^="choice-"]');
  if ((await choice.count()) > 0) await choice.first().click();
  else await page.getByTestId("answer-text").fill("I am not sure");
  await page.getByTestId("submit-answer").click();
  await expect(page.getByTestId("review-result")).toContainText(/go printed/i);

  // --------------------------------------------------------------- progress
  await page.goto("/dashboard");
  await expect(page.getByTestId("lesson-defer-timing")).toHaveAttribute("data-status", "completed");

  // --------------------------------------------------------------- notebook
  await page.goto("/notebook?kind=stretch");
  const entry = page.getByTestId("notebook-entry").filter({ hasText: "M6 · defer evaluates arguments now" });
  await expect(entry).toHaveCount(1);
  await expect(entry.getByTestId("entry-body")).toHaveText(STRETCH);

  expect(errors).toEqual([]);
});
