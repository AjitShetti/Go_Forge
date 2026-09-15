import { env, expect, expectNoHorizontalScroll, test } from "./fixtures";

// A first-time visitor who is not signed in.

test("landing → track → a lesson, with an honest NOT SAVED badge", async ({ page, errors }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/go from/i);
  await page.getByRole("link", { name: "Start the track" }).click();
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.locator("[data-testid^=module-M]")).toHaveCount(13);
  await expect(page.getByTestId("module-M12").locator(".label")).toHaveText(/^1 lesson$/i);

  await page.getByRole("link", { name: "Two appends, one backing array" }).click();
  await expect(page.getByTestId("step-provoke")).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText(/not saved/i);
  await expect(page.getByTestId("run-trap")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("every main nav link opens its page", async ({ page, errors }) => {
  const nav = [
    ["Track", "/track"],
    ["Review", "/review"],
    ["Progress", "/dashboard"],
    ["Canvas", "/canvas"],
    ["Scenarios", "/scenarios"],
    ["Notebook", "/notebook"],
    ["Engine", "/engine"],
  ] as const;
  await page.goto("/");
  for (const [label, href] of nav) {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator("h1")).not.toBeEmpty();
  }
  await expect(page.getByTestId("not-implemented")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("pages that need an account say so instead of breaking", async ({ page }) => {
  for (const [path, gate] of [
    ["/review", "learner-gate"],
    ["/dashboard", "learner-gate"],
    ["/canvas", "designs-gate"],
    ["/notebook", "notebook-gate"],
  ]) {
    await page.goto(path);
    await expect(page.getByTestId(gate), path).toHaveAttribute("data-kind", "signed-out");
  }
});

test("unknown addresses get the styled 404", async ({ page }) => {
  for (const path of ["/nope", "/track/m3-slices-maps/not-a-lesson", "/scenarios/not-a-scenario"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByTestId("not-found")).toBeVisible();
  }
  await page.getByRole("link", { name: "Go to the track" }).click();
  await expect(page).toHaveURL(/\/track$/);
});

test("sign in: the magic-link form confirms, and bad callbacks land back on /login", async ({ page }) => {
  test.skip(!env.NEXT_PUBLIC_SUPABASE_URL, "Supabase not configured");
  // Don't send a real email: answer the OTP request the way Supabase does on success.
  let requested: string | null = null;
  await page.route("**/auth/v1/otp**", async (route) => {
    requested = JSON.parse(route.request().postData() ?? "{}").email ?? null;
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByRole("button", { name: "Email me a magic link" }).click();
  await expect(page.getByTestId("magic-link-sent")).toContainText("learner@example.com");
  expect(requested).toBe("learner@example.com");

  await page.goto("/auth/callback?token_hash=bogus&type=magiclink");
  await expect(page).toHaveURL(/\/login\?error=/);
  await expect(page.getByTestId("auth-error")).toBeVisible();
});

test("phone width: no page scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/track", "/track/m5-interfaces/nil-interface", "/scenarios", "/scenarios/chat-presence", "/canvas/new", "/engine", "/login", "/notebook", "/nope"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});
