import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));

import { isOriginPermitted } from "@/lib/auth/widget";
import {
  parseAgentSettingsPatch,
  parseAllowedOrigins,
  SETTINGS_LIMITS,
} from "./settings-input";

describe("parseAllowedOrigins", () => {
  it.each([
    ["https://app.example.com"],
    ["http://localhost:3000"],
    ["https://example.com/path"],
    ["*.example.com"],
    ["example.com"],
    ["localhost"],
  ])("keeps %s", (origin) => {
    expect(parseAllowedOrigins([origin])).toEqual({ origins: [origin] });
  });

  it("every accepted form is one the widget matcher can match", () => {
    const app = "https://app.penaven.example";
    expect(isOriginPermitted("https://a.example.com", ["*.example.com"], app)).toBe(true);
    expect(isOriginPermitted("https://example.com", ["example.com"], app)).toBe(true);
    expect(isOriginPermitted("https://b.example", ["https://b.example"], app)).toBe(true);
  });

  it("trims entries and allows an empty list", () => {
    expect(parseAllowedOrigins(["  https://a.example  "])).toEqual({
      origins: ["https://a.example"],
    });
    expect(parseAllowedOrigins([])).toEqual({ origins: [] });
  });

  it.each([
    ["ftp://example.com"],
    ["javascript:alert(1)"],
    ["not a url"],
    ["not-a-url"],
    [""],
    ["https://"],
    ["*."],
    ["*"],
    ["https://*.example.com"],
    ["localhost:3000"],
  ])("rejects %j", (origin) => {
    expect(parseAllowedOrigins([origin])).toHaveProperty("error");
  });

  it.each([["https://b.example"], [null], [5], [{}]])("rejects the non-list %j", (value) => {
    expect(parseAllowedOrigins(value)).toHaveProperty("error");
  });

  it("rejects a non-string entry", () => {
    expect(parseAllowedOrigins(["https://a.example", 5])).toHaveProperty("error");
  });

  it("limits the list to 50 entries", () => {
    const origin = "https://a.example";
    expect(parseAllowedOrigins(Array(SETTINGS_LIMITS.allowedOrigins).fill(origin))).toHaveProperty(
      "origins",
    );
    expect(
      parseAllowedOrigins(Array(SETTINGS_LIMITS.allowedOrigins + 1).fill(origin)),
    ).toHaveProperty("error");
  });

  it("requires each entry to be under 300 characters", () => {
    const fits = `https://${"a".repeat(50)}.example/${"b".repeat(299 - 67)}`;
    expect(fits).toHaveLength(299);
    expect(parseAllowedOrigins([fits])).toHaveProperty("origins");
    expect(parseAllowedOrigins([`${fits}b`])).toHaveProperty("error");
  });
});

describe("parseAgentSettingsPatch", () => {
  it("accepts an empty patch and valid fields", () => {
    expect(parseAgentSettingsPatch({})).toEqual({ patch: {} });
    expect(
      parseAgentSettingsPatch({
        greeting: " Hi ",
        tone: "concise",
        instructions: "Be brief.",
        widget: { allowedOrigins: ["https://a.example"] },
      }),
    ).toEqual({
      patch: {
        greeting: "Hi",
        tone: "concise",
        instructions: "Be brief.",
        allowedOrigins: ["https://a.example"],
      },
    });
  });

  it("leaves origins alone when widget has no list", () => {
    expect(parseAgentSettingsPatch({ widget: {} })).toEqual({ patch: {} });
  });

  it.each([
    [{ tone: "angry" }],
    [{ tone: null }],
    [{ tone: 1 }],
    [{ greeting: 123 }],
    [{ greeting: null }],
    [{ greeting: "   " }],
    [{ greeting: "" }],
    [{ greeting: "g".repeat(501) }],
    [{ instructions: 5 }],
    [{ instructions: "i".repeat(4001) }],
    [{ widget: "x" }],
    [{ widget: [] }],
    [{ widget: null }],
    [{ widget: { allowedOrigins: "https://b.example" } }],
    [{ widget: { allowedOrigins: null } }],
  ])("rejects %j", (body) => {
    expect(parseAgentSettingsPatch(body)).toHaveProperty("error");
  });

  it("accepts text at the length limits", () => {
    expect(
      parseAgentSettingsPatch({
        greeting: "g".repeat(500),
        instructions: "i".repeat(4000),
      }),
    ).toHaveProperty("patch");
  });
});
