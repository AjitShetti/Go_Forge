import { expect, test } from "./fixtures";

// A learner keeps their own notes next to the stretch answers.

test("write a note about a lesson, filter to it, delete it", async ({ page, errors, learner }) => {
  const marker = `flow note ${Date.now()}`;
  page.on("dialog", (d) => d.accept());

  await page.goto("/notebook");
  await expect(page.getByTestId("not-implemented")).toHaveCount(0);
  await expect(page.getByTestId("add-note"), "an empty note can't be saved").toBeDisabled();

  await page.getByTestId("note-body").fill(`${marker}\n  indented second line`);
  await page.getByTestId("note-lesson").selectOption("go/m5-interfaces/nil-interface");
  await page.getByTestId("add-note").click();
  const entry = page.getByTestId("notebook-entry").filter({ hasText: marker });
  await expect(entry).toHaveCount(1);
  await expect(entry).toHaveAttribute("data-kind", "note");
  await expect(entry.getByTestId("entry-body")).toHaveText(`${marker}\n  indented second line`);
  await expect(entry.getByRole("link", { name: "M5 · A nil pointer in an interface is not nil" })).toHaveAttribute("href", "/track/m5-interfaces/nil-interface");
  await expect(page.getByTestId("note-body")).toHaveValue("");

  // It really is in the database, as this learner's row.
  const { data } = await learner.db.from("notebook").select("user_id, kind").like("body", `${marker}%`);
  expect(data).toEqual([{ user_id: learner.userId, kind: "note" }]);

  await page.getByRole("link", { name: /^Stretch \d+$/ }).click();
  await expect(page.getByTestId("notebook-entry").filter({ hasText: marker })).toHaveCount(0);
  await page.getByRole("link", { name: /^Notes \d+$/ }).click();
  await expect(entry).toHaveCount(1);

  await entry.getByTestId("delete-entry").click();
  await expect(entry).toHaveCount(0);
  const after = await learner.db.from("notebook").select("id").like("body", `${marker}%`);
  expect(after.data).toEqual([]);
  expect(errors).toEqual([]);
});
