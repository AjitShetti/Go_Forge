import { expect, test } from "./fixtures";

// Runs last: signing out ends the learner's session for this browser context.

test("signed in, /login redirects; sign out gates personal pages again", async ({ page, errors, learner }) => {
  void learner;
  await page.goto("/login");
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.getByTestId("user-email")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByTestId("user-email")).toHaveCount(0);

  await page.goto("/notebook");
  await expect(page.getByTestId("notebook-gate")).toHaveAttribute("data-kind", "signed-out");
  await page.goto("/review");
  await expect(page.getByTestId("learner-gate")).toHaveAttribute("data-kind", "signed-out");
  await page.goto("/track/m6-errors/defer-timing");
  await expect(page.getByTestId("save-status")).toContainText(/not saved/i);
  expect(errors).toEqual([]);
});
