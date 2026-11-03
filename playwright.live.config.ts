import { defineConfig, devices } from "@playwright/test";

/**
 * Read-only smoke checks against a deployed site. GET requests and page loads
 * only: no sign-in, no chat, no form submits, no uploads. One worker, no
 * retries, so a run is a handful of requests.
 */
const baseURL = (process.env.LIVE_BASE_URL ?? "https://penaven.vercel.app").replace(/\/$/, "");

export default defineConfig({
  testDir: "./e2e/live",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results/live",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
