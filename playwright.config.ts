import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const isWindows = process.platform === "win32";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const defaultWidgetKey = "wk_test_e2e_demo_widget_key";

process.env.DEMO_WIDGET_KEY ??= defaultWidgetKey;
process.env.PLAYWRIGHT_DASHBOARD ??= "1";
process.env.AUTH_BYPASS ??= "true";
process.env.NEXT_PUBLIC_AUTH_BYPASS ??= "true";

const serverEnv = {
  CI: isCI ? "true" : process.env.CI ?? "",
  AUTH_BYPASS: process.env.AUTH_BYPASS ?? "true",
  NEXT_PUBLIC_AUTH_BYPASS: process.env.NEXT_PUBLIC_AUTH_BYPASS ?? "true",
  E2E_AUTH_BYPASS: isCI ? "true" : process.env.E2E_AUTH_BYPASS ?? "",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  APP_URL: process.env.APP_URL ?? baseURL,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
  DEMO_WIDGET_KEY: process.env.DEMO_WIDGET_KEY ?? defaultWidgetKey,
};

export default defineConfig({
  testDir: "./e2e",
  // Each has its own config: playwright.two-clients.config.ts and playwright.live.config.ts.
  testIgnore: ["two-clients/**", "live/**"],
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: !isWindows,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI || isWindows ? 1 : undefined,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isCI ? "npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: serverEnv,
  },
});
