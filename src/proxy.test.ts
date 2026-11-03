import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => vi.fn(),
  createRouteMatcher: () => () => false,
}));

import { isPathWithNul, proxy } from "./proxy";
import nextConfig from "../next.config";
import { MULTIPART_OVERHEAD_BYTES } from "@/lib/api/form-data";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/constants";
import { DEMO_READ_ONLY_MESSAGE } from "@/lib/env/public-demo";

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

/** Every route file and the write methods it exports, so a new route is covered here by default. */
function writeRoutes() {
  const apiRoot = join(__dirname, "app", "api");
  const routes: Array<{ method: string; path: string }> = [];
  for (const file of readdirSync(apiRoot, { recursive: true, encoding: "utf8" })) {
    if (!file.endsWith("route.ts")) continue;
    const path = `/api/${file.replace(/\\/g, "/").replace(/\/?route\.ts$/, "")}`.replace(
      /\[[^\]]+\]/g,
      "abc123",
    );
    const source = readFileSync(join(apiRoot, file), "utf8");
    for (const match of source.matchAll(/export async function (POST|PUT|PATCH|DELETE)\b/g)) {
      routes.push({ method: match[1], path });
    }
  }
  return routes;
}

const DEMO_WRITE_ROUTES = new Set([
  "POST /api/chat",
  "POST /api/chat/stream",
  "POST /api/contact",
  "POST /api/demo/seed",
  "POST /api/messages/abc123/feedback",
  "POST /api/webhooks/clerk",
  "POST /api/widget/chat/stream",
  "POST /api/widget/messages/abc123/feedback",
  "POST /api/widget/session",
  "POST /api/widget/tickets",
]);

describe("public demo write guard", () => {
  const send = (method: string, path: string) =>
    proxy(new NextRequest(`http://localhost${path}`, { method }), {} as NextFetchEvent);

  afterEach(() => vi.unstubAllEnvs());

  function stubDemo(flag = "PUBLIC_DEMO_MODE") {
    vi.stubEnv(flag, "true");
    vi.stubEnv("AUTH_BYPASS", "true");
  }

  it("finds the whole write surface", () => {
    expect(writeRoutes().length).toBeGreaterThanOrEqual(32);
  });

  it.each(writeRoutes())("$method $path is allowed only if listed", async ({ method, path }) => {
    stubDemo();
    const response = await send(method, path);

    if (DEMO_WRITE_ROUTES.has(`${method} ${path}`)) {
      expect(response?.status).toBe(200);
      expect(response?.headers.get("x-middleware-next")).toBe("1");
    } else {
      expect(response?.status).toBe(403);
      expect(await response?.json()).toEqual({
        error: DEMO_READ_ONLY_MESSAGE,
        code: "DEMO_READ_ONLY",
      });
    }
  });

  it("also applies with only the public build flag", async () => {
    stubDemo("NEXT_PUBLIC_PUBLIC_DEMO_MODE");
    expect((await send("DELETE", "/api/documents/abc123"))?.status).toBe(403);
  });

  it("blocks a write route that does not exist yet", async () => {
    stubDemo();
    expect((await send("POST", "/api/new-admin-thing"))?.status).toBe(403);
    expect((await send("PUT", "/api/chat"))?.status).toBe(200); // The route itself rejects PUT.
  });

  it.each([
    "/api/messages/a/b/feedback",
    "/api/messages/feedback",
    "/api/chat/",
    "/api/chat/other",
    "/api/widget",
    "/api/widget/",
    "/api/widget/..%2ftickets",
    "/api/widget/%2e%2e%2ftickets",
    "/api/widgets/session",
    "/api/demo/seed/extra",
    "/API/tickets",
    "/Api/chat",
    "/%61pi/tickets",
    "/%61pi/chat",
    "//api/tickets",
    "/api",
  ])("POST %s is blocked", async (path) => {
    stubDemo();
    expect((await send("POST", path))?.status).toBe(403);
  });

  it.each(["HEAD", "OPTIONS"])("%s counts as a write and fails closed", async (method) => {
    stubDemo();
    expect((await send(method, "/api/tickets"))?.status).toBe(403);
  });

  it.each([
    "/api/tickets",
    "/api/tickets/abc123",
    "/api/documents",
    "/api/conversations",
    "/api/health",
  ])("GET %s still passes", async (path) => {
    stubDemo();
    expect((await send("GET", path))?.status).toBe(200);
  });

  it("leaves page posts alone", async () => {
    stubDemo();
    expect((await send("POST", "/api-docs"))?.status).toBe(200);
    expect((await send("POST", "/dashboard"))?.status).toBe(200);
  });

  it("does nothing outside demo mode", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    for (const { method, path } of writeRoutes()) {
      const response = await send(method, path);
      expect(response?.status).toBe(200);
    }
  });

  it("still returns 404 for a NUL before the write guard", async () => {
    stubDemo();
    expect((await send("POST", "/api/tickets/%00"))?.status).toBe(404);
  });
});

describe("proxy body limit", () => {
  it("sits above the largest upload so the routes can return 413", () => {
    const limit = nextConfig.experimental?.proxyClientMaxBodySize;
    expect(limit).toBe("11mb");
    expect(11 * 1024 * 1024).toBeGreaterThan(MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES);
  });
});
