import { afterEach, describe, expect, it, vi } from "vitest";
import { canSeedFromBrowser, demoSeedDeniedMessage, isDemoSeedAllowed } from "./demo-guard";

describe("demoSeedDeniedMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not claim the secret is missing when it is set", () => {
    vi.stubEnv("DEMO_SEED_SECRET", "test-secret");
    expect(demoSeedDeniedMessage()).toBe("Missing or incorrect demo seed secret.");
  });

  it("names the missing setting when it is not set", () => {
    vi.stubEnv("DEMO_SEED_SECRET", "");
    expect(demoSeedDeniedMessage()).toMatch(/without DEMO_SEED_SECRET/);
  });
});

describe("isDemoSeedAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests with a matching x-demo-seed-secret header", () => {
    vi.stubEnv("DEMO_SEED_SECRET", "test-secret");
    vi.stubEnv("NODE_ENV", "production");

    const request = new Request("http://localhost/api/demo/seed", {
      headers: { "x-demo-seed-secret": "test-secret" },
    });

    expect(isDemoSeedAllowed(request)).toBe(true);
  });

  it("rejects requests when the secret header does not match", () => {
    vi.stubEnv("DEMO_SEED_SECRET", "test-secret");
    vi.stubEnv("NODE_ENV", "production");

    const request = new Request("http://localhost/api/demo/seed", {
      headers: { "x-demo-seed-secret": "wrong-secret" },
    });

    expect(isDemoSeedAllowed(request)).toBe(false);
  });

  it("allows development requests when no secret is configured", () => {
    vi.stubEnv("DEMO_SEED_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");

    const request = new Request("http://localhost/api/demo/seed");

    expect(isDemoSeedAllowed(request)).toBe(true);
  });

  it("rejects development requests when a secret is configured but missing from the request", () => {
    vi.stubEnv("DEMO_SEED_SECRET", "test-secret");
    vi.stubEnv("NODE_ENV", "development");

    const request = new Request("http://localhost/api/demo/seed");

    expect(isDemoSeedAllowed(request)).toBe(false);
  });

  it("rejects production requests when no secret is configured", () => {
    vi.stubEnv("DEMO_SEED_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");

    const request = new Request("http://localhost/api/demo/seed");

    expect(isDemoSeedAllowed(request)).toBe(false);
  });
});

describe("canSeedFromBrowser", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true in development with the auth bypass and no seed secret", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_SEED_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_AUTH_BYPASS", "true");
    expect(canSeedFromBrowser()).toBe(true);
  });

  it("is false when a seed secret is set, because the browser never sends it", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_SEED_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_AUTH_BYPASS", "true");
    expect(canSeedFromBrowser()).toBe(false);
    const browserClick = new Request("http://localhost/api/demo/seed", { method: "POST" });
    expect(isDemoSeedAllowed(browserClick)).toBe(false);
  });

  it("is false in production and without the auth bypass", () => {
    vi.stubEnv("DEMO_SEED_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_AUTH_BYPASS", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(canSeedFromBrowser()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_AUTH_BYPASS", "");
    expect(canSeedFromBrowser()).toBe(false);
  });
});
