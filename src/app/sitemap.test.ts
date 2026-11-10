import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { organization: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  beforeEach(() => {
    findMany.mockReset();
    vi.stubEnv("APP_URL", "https://app.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists the public pages and each public help centre", async () => {
    const updatedAt = new Date("2026-11-01T00:00:00Z");
    findMany.mockResolvedValue([
      { slug: "acme", updatedAt },
      { slug: "beta co", updatedAt },
    ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual([
      "https://app.example.com",
      "https://app.example.com/help",
      "https://app.example.com/contact",
      "https://app.example.com/demo/hiring",
      "https://app.example.com/help/acme",
      "https://app.example.com/help/beta%20co",
    ]);
    expect(entries[4].lastModified).toBe(updatedAt);

    // Only help centres that are switched on and have ready articles.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          widgetEnabled: true,
          documents: { some: { status: "READY" } },
        },
        select: { slug: true, updatedAt: true },
      }),
    );
  });

  const STATIC_URLS = [
    "https://app.example.com",
    "https://app.example.com/help",
    "https://app.example.com/contact",
    "https://app.example.com/demo/hiring",
  ];

  it("still returns the static pages when the build has no database", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("DATABASE_URL", "");
    findMany.mockRejectedValue(new Error("DATABASE_URL is not set"));

    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual(STATIC_URLS);
    consoleError.mockRestore();
  });

  it("still returns the static pages when the database is down during next build", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/db");
    findMany.mockRejectedValue(new Error("connection refused"));

    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual(STATIC_URLS);
    consoleError.mockRestore();
  });

  it("throws on a database error at revalidation, so the last good sitemap stays cached", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/db");
    findMany.mockRejectedValue(new Error("connection refused"));

    await expect(sitemap()).rejects.toThrow("connection refused");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
