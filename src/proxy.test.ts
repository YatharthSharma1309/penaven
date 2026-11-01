import { NextRequest, type NextFetchEvent } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => vi.fn(),
  createRouteMatcher: () => () => false,
}));

import { isPathWithNul, proxy } from "./proxy";
import nextConfig from "../next.config";
import { MULTIPART_OVERHEAD_BYTES } from "@/lib/api/form-data";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/constants";

const ROUTES_WITH_IDS = [
  "/api/conversations/%00",
  "/api/documents/%00",
  "/api/messages/%00/feedback",
  "/api/recruitment/candidates/%00",
  "/api/recruitment/candidates/%00/file",
  "/api/recruitment/jobs/%00",
  "/api/recruitment/jobs/%00/export",
  "/api/recruitment/jobs/%00/hire/finalize",
  "/api/recruitment/jobs/%00/hire/undo",
  "/api/recruitment/jobs/%00/share",
  "/api/tickets/%00",
  "/api/tickets/%00/comments",
  "/api/tickets/%00/suggest-reply",
  "/api/widget/messages/%00/feedback",
  "/api/tickets/abc%00def",
];

describe("NUL in an API path", () => {
  it.each(ROUTES_WITH_IDS)("%s returns 404 from the proxy", async (path) => {
    const response = await proxy(
      new NextRequest(`http://localhost${path}`),
      {} as NextFetchEvent,
    );
    expect(response?.status).toBe(404);
    expect(await response?.json()).toEqual({ error: "Not found" });
  });

  it("leaves other paths alone", () => {
    expect(isPathWithNul("/api/tickets/abc")).toBe(false);
    expect(isPathWithNul("/api/tickets/%2500")).toBe(false);
    expect(isPathWithNul("/tickets/abc")).toBe(false);
  });
});

describe("NUL in a page path", () => {
  it.each(["/tickets/%00", "/share/%00", "/help/%00", "/recruitment/jobs/%00"])(
    "%s returns 404 from the proxy",
    async (path) => {
      const response = await proxy(
        new NextRequest(`http://localhost${path}`),
        {} as NextFetchEvent,
      );
      expect(response?.status).toBe(404);
      expect(await response?.text()).toBe("Not found");
    },
  );
});

describe("proxy body limit", () => {
  it("sits above the largest upload so the routes can return 413", () => {
    const limit = nextConfig.experimental?.proxyClientMaxBodySize;
    expect(limit).toBe("11mb");
    expect(11 * 1024 * 1024).toBeGreaterThan(MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES);
  });
});
