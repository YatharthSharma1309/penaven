import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";

function asArray(value: string | string[] | undefined) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

describe("robots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows public pages, blocks private ones, and points at the sitemap", () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules).toHaveLength(1);
    const [rule] = rules;

    expect(rule.userAgent).toBe("*");
    expect(asArray(rule.allow)).toEqual(["/", "/help", "/contact", "/demo"]);

    const disallow = asArray(rule.disallow);
    for (const path of [
      "/api/",
      "/dashboard",
      "/inbox",
      "/tickets",
      "/knowledge",
      "/widget",
      "/analytics",
      "/hiring",
      "/recruitment",
      "/settings",
      "/chat",
      "/onboarding",
      "/sign-in",
      "/sign-up",
      "/share/",
    ]) {
      expect(disallow).toContain(path);
    }
    for (const path of ["/", "/help", "/contact", "/demo"]) {
      expect(disallow).not.toContain(path);
    }

    expect(result.sitemap).toBe("https://app.example.com/sitemap.xml");
  });
});
