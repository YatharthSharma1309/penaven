import { describe, expect, it } from "vitest";
import { absoluteUrl, DEFAULT_SITE_URL, getSiteUrl } from "@/lib/site-url";

describe("getSiteUrl", () => {
  it("prefers APP_URL and drops the trailing slash", () => {
    expect(
      getSiteUrl({
        APP_URL: " https://app.example.com/ ",
        NEXT_PUBLIC_APP_URL: "https://public.example.com",
        VERCEL_PROJECT_PRODUCTION_URL: "vercel.example.com",
      }),
    ).toBe("https://app.example.com");
  });

  it("falls back to NEXT_PUBLIC_APP_URL", () => {
    expect(
      getSiteUrl({ APP_URL: "  ", NEXT_PUBLIC_APP_URL: "https://public.example.com" }),
    ).toBe("https://public.example.com");
  });

  it("prefixes the Vercel production domain with https://", () => {
    expect(
      getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "penaven.example.app" }),
    ).toBe("https://penaven.example.app");
  });

  it("skips a value that is not a URL", () => {
    expect(
      getSiteUrl({ APP_URL: "http://", NEXT_PUBLIC_APP_URL: "https://ok.example.com" }),
    ).toBe("https://ok.example.com");
  });

  it("uses the default host when nothing is set", () => {
    expect(getSiteUrl({})).toBe(DEFAULT_SITE_URL);
    expect(DEFAULT_SITE_URL).toBe("https://penaven.vercel.app");
  });

  it("keeps http for a local APP_URL", () => {
    expect(getSiteUrl({ APP_URL: "http://localhost:3000" })).toBe(
      "http://localhost:3000",
    );
  });
});

describe("absoluteUrl", () => {
  it("joins paths onto the site URL", () => {
    expect(absoluteUrl("/", "https://a.test")).toBe("https://a.test");
    expect(absoluteUrl("/help", "https://a.test")).toBe("https://a.test/help");
    expect(absoluteUrl("help", "https://a.test")).toBe("https://a.test/help");
  });
});
