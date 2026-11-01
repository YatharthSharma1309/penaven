import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertProductionEnv } from "./production";

const NO_AI_WARNING = /No AI provider key set/;

function warnings(warn: ReturnType<typeof vi.spyOn>) {
  return warn.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PHASE", "");
  vi.stubEnv("CI", "");
  vi.stubEnv("AUTH_BYPASS", "");
  vi.stubEnv("NEXT_PUBLIC_AUTH_BYPASS", "");
  vi.stubEnv("PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
  vi.stubEnv("DATABASE_URL", "postgres://user:pass@127.0.0.1:1/test");
  vi.stubEnv("APP_URL", "https://app.example.com");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_value");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_value");
  vi.stubEnv("WIDGET_VISITOR_SECRET", "secret");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("GOOGLE_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("assertProductionEnv AI key check", () => {
  it("warns but does not throw when no provider is configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertProductionEnv()).not.toThrow();
    expect(warnings(warn).some((line) => NO_AI_WARNING.test(line))).toBe(true);
  });

  it("treats a placeholder key as not configured", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "changeme");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    assertProductionEnv();
    expect(warnings(warn).some((line) => NO_AI_WARNING.test(line))).toBe(true);
  });

  it("stays quiet when a provider is configured", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key-not-real");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    assertProductionEnv();
    expect(warnings(warn).some((line) => NO_AI_WARNING.test(line))).toBe(false);
  });
});
