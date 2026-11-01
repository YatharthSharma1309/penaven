import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const entries = readFileSync(path.join(process.cwd(), ".vercelignore"), "utf8")
  .split(/\r?\n/)
  .filter(Boolean);

describe(".vercelignore", () => {
  it.each([
    ".env",
    ".env.*",
    "!.env.example",
    ".neon-init-payload.json",
    ".clerk",
    "uploads",
    ".next",
    "node_modules",
    "test-results",
    "playwright-report",
    "*.tsbuildinfo",
    ".claude",
    ".vercel",
  ])("lists %s", (entry) => {
    expect(entries).toContain(entry);
  });

  it.each(["src", "public", "prisma", "demo", "package.json", "next.config.ts"])(
    "keeps %s, which the build or the running app reads",
    (entry) => {
      expect(entries).not.toContain(entry);
    },
  );
});
