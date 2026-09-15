import { defineConfig } from "@playwright/test";

// User-journey flows (tests/e2e) in real Edge against a production build.
//   npm run build && npm run test:e2e
// Signed-in flows need E2E_EMAIL / E2E_PASSWORD in .env.local and a reset e2e user
// (supabase/e2e-reset.sql). One worker: every signed-in spec is the same learner.
const PORT = Number(process.env.E2E_PORT ?? 3700);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "msedge",
    headless: true,
    viewport: { width: 1360, height: 900 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
