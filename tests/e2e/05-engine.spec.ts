import { expect, test } from "./fixtures";

// The engine page: real Go compiled and run in the tab.

test("runs goroutines, reports compile errors and runtime panics like go run", async ({ page, errors }) => {
  test.slow();
  await page.goto("/engine");
  const run = page.locator("#run");
  await expect(run).toBeEnabled({ timeout: 120_000 });

  await run.click();
  await expect(page.getByTestId("stdout")).toContainText("sum of squares: 55", { timeout: 60_000 });

  await page.locator("#code").fill('package main\n\nfunc main() {\n\tx := 1\n}\n');
  await run.click();
  await expect(page.getByTestId("stderr")).toContainText("declared and not used: x", { timeout: 60_000 });

  await page.locator("#code").fill('package main\n\nfunc main() {\n\tvar m map[string]int\n\tm["a"] = 1\n}\n');
  await run.click();
  await expect(page.getByTestId("stderr")).toContainText("panic: assignment to entry in nil map", { timeout: 60_000 });
  await expect(page.getByTestId("result")).toContainText(`"exitCode": 2`); // as go run
  expect(errors).toEqual([]);
});
