import { join } from "node:path";
import { expect, test } from "./fixtures";

// A signed-in learner designs the ticketing flash sale: starts from the naive
// design, reads the grade, fixes a finding, saves two versions, diffs them,
// exports, imports the file into a fresh canvas, and deletes the design.

type DesignState = { designKey: string | null; dirty: boolean; status: string; scenario: string | null; graph: { nodes: { id: string; config: Record<string, unknown> }[] } };
const designState = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __designState: DesignState }).__designState);

test("scenario → grade → fix → save v1/v2 → diff → export/import → delete", async ({ page, errors, learner }, testInfo) => {
  test.slow();
  const name = `Flow flash sale ${Date.now()}`;
  page.on("dialog", (d) => d.accept());

  // ---------------------------------------------------------- brief + start
  await page.goto("/scenarios");
  await page.getByRole("link", { name: "Event ticketing: flash sale" }).click();
  await expect(page.getByTestId("scenario-constraints")).toContainText("No seat is sold twice");
  await page.getByTestId("start-naive").click();
  await expect.poll(async () => (await designState(page))?.graph.nodes.length).toBe(3);
  await expect(page.getByTestId("design-scenario")).toHaveValue("ticketing-flash-sale");

  // ------------------------------------------------------------------ grade
  await page.getByTestId("grade-design").click();
  await expect(page.getByTestId("grade-score")).toHaveText("35");
  await expect(page.getByTestId("grade-record")).toHaveAttribute("data-kind", "not-recorded");
  const capacity = page.locator('[data-testid="finding"][data-rule="capacity"]');
  await expect(capacity, "the capacity finding shows its arithmetic").toContainText("capacity = 1 replica × 2,000 rps = 2,000 rps");

  // Fix it in the inspector; the open report regrades as you type.
  await capacity.getByText("show on canvas").click();
  await expect(page.locator('.react-flow__node[data-id="app"]')).toHaveClass(/selected/);
  await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
  await page.locator('.react-flow__node[data-id="app"]').click();
  await page.getByTestId("inspector-replicas").fill("200");
  await page.getByTestId("inspector-replicas").blur();
  await expect(capacity).toHaveCount(0);

  // ----------------------------------------------------------------- save v1
  await page.getByTestId("design-name").fill(name);
  await page.getByTestId("save-design").click();
  await expect(page).toHaveURL(/\/canvas\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("design-status")).toContainText(/saved · v1/i);
  const { designKey } = await designState(page);

  // ------------------------------------------------- edit, Ctrl+S saves v2
  await page.getByTestId("palette-cache").click();
  await expect(page.getByTestId("design-status")).toContainText(/unsaved/i);
  await page.keyboard.press("Control+s");
  await expect(page.getByTestId("design-status")).toContainText(/saved · v2/i);

  // Grading a saved design records it.
  await page.getByTestId("grade-design").click();
  await expect(page.getByTestId("grade-record")).toHaveAttribute("data-kind", "recorded");
  await expect(page.getByTestId("grade-record")).toContainText("UTC");
  const { data: reviews } = await learner.db.from("design_reviews").select("score, designs!inner(design_key)").eq("designs.design_key", designKey!);
  expect(reviews?.length).toBe(1);

  // ---------------------------------------------------------- history + diff
  await page.getByTestId("toggle-history").click();
  await expect(page.getByTestId("version-1")).toBeVisible();
  await page.getByTestId("diff-1").click();
  await expect(page.getByTestId("diff-summary")).toContainText(/components added · 1/i);
  await expect(page.getByTestId("diff-summary")).toContainText("Cache");
  await page.goBack();

  // ------------------------------------------------------- export → import
  await expect(page.getByTestId("design-status")).toContainText(/saved · v2/i);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-design").click()]);
  const file = testInfo.outputPath("export.json");
  await download.saveAs(file);
  expect(download.suggestedFilename()).toMatch(/-v2\.json$/);

  await page.goto("/canvas/new");
  await page.getByTestId("import-file").setInputFiles(file);
  await expect(page.getByTestId("canvas-notice")).toContainText("Imported 4 components");
  await expect(page.getByTestId("design-name")).toHaveValue(name);
  await expect(page.getByTestId("design-scenario"), "the scenario travels with the file").toHaveValue("ticketing-flash-sale");
  await expect(page.getByTestId("grade-design")).toBeEnabled();

  // A broken file is explained, not loaded.
  const bad = join(testInfo.outputDir, "bad.json");
  await import("node:fs").then((fs) => fs.writeFileSync(bad, "{ not json"));
  await page.getByTestId("import-file").setInputFiles(bad);
  await expect(page.getByTestId("import-errors")).toContainText("not valid JSON");

  // ------------------------------------------------------------------ delete
  await page.goto("/canvas");
  const row = page.getByTestId(`design-${designKey}`);
  await expect(row).toContainText("v2 · 2 versions");
  await row.getByTestId("delete-design").click();
  await expect(row).toHaveCount(0);
  const { data: left } = await learner.db.from("designs").select("id").eq("design_key", designKey!);
  expect(left).toEqual([]);

  // The unsaved imported canvas asked before leaving; nothing else went wrong.
  expect(errors).toEqual([]);
});
