import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { parse } from "dotenv";
import { assertTwoClientsEnv } from "./tests/integration/env-guard";
import { CLERK_PORT, CLIENTS, type Client } from "./e2e/two-clients/clients";

/**
 * Two sample businesses on one local database, each with its own server.
 *
 * The Clerk instance has no organizations feature, and a workspace needs a
 * Clerk organization, so the walkthrough signs in with the demo bypass: each
 * server is pinned to one workspace by DEMO_ORGANIZATION_SLUG,
 * DEMO_USER_EMAIL and DEMO_WIDGET_KEY. The real Clerk sign-in is in
 * clerk-sign-in.spec.ts and runs only with TWO_CLIENTS_CLERK=1.
 *
 * Refuses anything but a local DATABASE_URL.
 */
assertTwoClientsEnv();

const isCI = !!process.env.CI;
const distDir = ".next-e2e-two-clients";

/** Only the two Clerk keys, never the rest of the file (it may name a hosted database). */
function loadClerkKeys() {
  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return;

  const file = process.env.TWO_CLIENTS_CLERK_ENV_FILE ?? ".env.local";
  if (!fs.existsSync(file)) return;

  const values = parse(fs.readFileSync(file));
  for (const name of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
    if (!process.env[name] && values[name]) process.env[name] = values[name];
  }
}

loadClerkKeys();

/**
 * Set explicitly, even when blank: Next.js loads `.env*` files for any name the
 * process does not already have, and a checkout's `.env.local` may hold model
 * keys, a hosted DATABASE_URL or Clerk keys.
 */
const isolatedEnv = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  NEXT_DIST_DIR: distDir,
  NEXT_TELEMETRY_DISABLED: "1",
  OPENROUTER_API_KEY: "",
  OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  OPENROUTER_EMBEDDING_MODEL: "",
  AI_PROVIDER_PREFERENCE: "",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  FIREBASE_DATABASE_URL: "",
  OPS_WORKER_URL: "",
  PUBLIC_DEMO_MODE: "",
  NEXT_PUBLIC_PUBLIC_DEMO_MODE: "",
  NEXT_PUBLIC_AUTH_BYPASS: "",
  VERCEL: "",
  VERCEL_ENV: "",
  VERCEL_URL: "",
  WIDGET_VISITOR_SECRET: "two-clients-e2e-only-not-a-real-secret",
};

function bypassServerEnv(client: Client) {
  return {
    ...isolatedEnv,
    // Without a publishable key the top bar leaves out Clerk's own controls,
    // which cannot render without ClerkProvider.
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    CLERK_SECRET_KEY: "",
    // `next start` is production: the bypass needs both flags, and the startup
    // check accepts it only with CI set.
    AUTH_BYPASS: "true",
    E2E_AUTH_BYPASS: "true",
    CI: "true",
    APP_URL: client.baseURL,
    DEMO_ORGANIZATION_SLUG: client.slug,
    DEMO_USER_EMAIL: client.ownerEmail,
    DEMO_WIDGET_KEY: client.widgetKey,
  };
}

const skipBuild = process.env.TWO_CLIENTS_SKIP_BUILD === "1";
const { clinic, shop } = CLIENTS;

type WebServer = {
  command: string;
  url: string;
  reuseExistingServer: boolean;
  timeout: number;
  env: Record<string, string>;
  stdout?: "pipe" | "ignore";
};

const webServer: WebServer[] = [
  {
    // One build serves both clients. Playwright starts the servers in order,
    // so the second one starts after the build.
    command: skipBuild
      ? `npx next start -p ${clinic.port}`
      : `npx next build && npx next start -p ${clinic.port}`,
    url: `${clinic.baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 600_000,
    env: bypassServerEnv(clinic),
    stdout: "pipe",
  },
  {
    command: `npx next start -p ${shop.port}`,
    url: `${shop.baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: bypassServerEnv(shop),
  },
];

if (process.env.TWO_CLIENTS_CLERK === "1") {
  // Real Clerk sign-in. A dev server, because a production build inlines
  // NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and the build above leaves it out.
  webServer.push({
    command: `npx next dev --webpack -p ${CLERK_PORT}`,
    url: `http://localhost:${CLERK_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...isolatedEnv,
      NEXT_DIST_DIR: `${distDir}-clerk`,
      APP_URL: `http://localhost:${CLERK_PORT}`,
      AUTH_BYPASS: "",
      E2E_AUTH_BYPASS: "",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
    },
  });
}

export default defineConfig({
  testDir: "./e2e/two-clients",
  globalSetup: "./e2e/two-clients/global-setup.ts",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results/two-clients",
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer,
});
