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

test("home page walks a design from a failing sketch to a pass, with the grader's real scores", async ({ page, errors }) => {
  await page.goto("/");
  await expect(page.getByTestId("how-it-works")).toBeVisible();
  const demo = page.getByTestId("canvas-demo");
  await page.getByTestId("demo-step-scenario").click(); // a click stops autoplay
  await expect(demo).toHaveAttribute("data-step", "scenario");
  await expect(page.getByTestId("demo-grade")).toHaveCount(0);
  for (const [step, score] of [["grade", "50"], ["scale", "80"], ["cache", "85"], ["replicate", "100"]]) {
    await page.getByTestId("demo-next").click();
    if (step === "grade") await page.getByTestId("demo-next").click(); // past the ungraded sketch
    await expect(demo).toHaveAttribute("data-step", step);
    await expect(page.getByTestId("demo-grade")).toHaveAttribute("data-score", score);
  }
  await expect(demo.locator("[data-testid^=node-]")).toHaveCount(6);
  await page.getByTestId("demo-try").click();
  await expect(page).toHaveURL(/\/canvas\/new\?scenario=url-shortener&start=naive$/);
  await expect(page.getByTestId("count-nodes")).toHaveText("3");
  expect(errors).toEqual([]);
});

test("every page links to GitHub for bug reports, and lessons prefill which lesson", async ({ page }) => {
  for (const path of ["/", "/engine", "/nope"]) {
    await page.goto(path);
    await expect(page.getByTestId("footer-report-bug"), path).toHaveAttribute("href", "https://github.com/AjitShetti/Go_Forge/issues/new?template=bug_report.yml");
    await expect(page.getByTestId("footer-github")).toHaveAttribute("href", "https://github.com/AjitShetti/Go_Forge");
  }
  await page.goto("/track/m5-interfaces/nil-interface");
  const href = new URL((await page.getByTestId("report-lesson").getAttribute("href"))!);
  expect([href.pathname, href.searchParams.get("template"), href.searchParams.get("lesson"), href.searchParams.get("step")]).toEqual([
    "/AjitShetti/Go_Forge/issues/new",
    "lesson_problem.yml",
    "m5-interfaces/nil-interface",
    "provoke",
  ]);
});

test("pages don't show repository file paths", async ({ page }) => {
  for (const path of ["/", "/engine", "/scenarios/url-shortener", "/track/m8-concurrency-2/data-races"]) {
    await page.goto(path);
    await expect(page.locator("main"), path).not.toContainText(/docs\/|supabase\/|scripts\/|\.sql\b|\.mjs\b/);
  }
  await page.goto("/engine");
  await page.getByTestId("engine-differences").locator("summary").click();
  await expect(page.getByTestId("engine-differences")).toContainText("the race detector");
});

test("every main nav link opens its page", async ({ page, errors }) => {
  const nav = [
    ["Track", "/track"],
    ["Reference", "/go"],
    ["Review", "/review"],
    ["Canvas", "/canvas"],
    ["Scenarios", "/scenarios"],
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
    ["/canvas", "designs-gate"],
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
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByTestId("magic-link-sent")).toContainText("learner@example.com");
  expect(requested).toBe("learner@example.com");

  // The emailed code works in any browser; a wrong one shows a readable error, not Supabase's.
  let verified: { email?: string; token?: string; type?: string } = {};
  await page.route("**/auth/v1/verify**", async (route) => {
    verified = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" }) });
  });
  await page.getByLabel("Code from the email").fill("123456");
  await page.getByRole("button", { name: "Sign in with code" }).click();
  await expect(page.getByTestId("login-error")).toContainText("expired or was already used");
  expect(verified).toMatchObject({ email: "learner@example.com", token: "123456", type: "email" });

  await page.goto("/auth/callback?token_hash=bogus&type=magiclink");
  await expect(page).toHaveURL(/\/login\?error=/);
  await expect(page.getByTestId("auth-error")).toBeVisible();

  // A link opened in another browser (e.g. an email app's built-in one) explains itself.
  await page.goto("/auth/callback?code=not-from-this-browser");
  await expect(page.getByTestId("auth-error")).toContainText("different browser");
});

test("phone width: no page scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/track", "/track/m5-interfaces/nil-interface", "/scenarios", "/scenarios/chat-presence", "/canvas/new", "/engine", "/login", "/review", "/nope"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});
