import { afterEach, describe, expect, it, vi } from "vitest";
import { demoSeedDeniedMessage, isDemoSeedAllowed } from "./demo-guard";

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
