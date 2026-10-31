import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drives the real /api/contact handler. Prisma is an in-memory fake, like
 * cap-handoff.test.ts, so no database is needed.
 */

type Row = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  contactMessages: [] as Row[],
  failNextCreate: false,
  seq: 0,
}));

vi.mock("@/lib/db", () => ({
  db: {
    contactMessage: {
      count: vi.fn(async ({ where }: { where: { createdAt: { gte: Date } } }) => {
        return store.contactMessages.filter(
          (row) => (row.createdAt as Date) >= where.createdAt.gte,
        ).length;
      }),
      create: vi.fn(async ({ data }) => {
        if (store.failNextCreate) {
          store.failNextCreate = false;
          const error = new Error(
            `connect ECONNREFUSED 127.0.0.1:5433 while saving ${JSON.stringify(data)}`,
          );
          Object.assign(error, { code: "ECONNREFUSED" });
          throw error;
        }
        const row = { id: `contact_${++store.seq}`, createdAt: new Date(), ...data };
        store.contactMessages.push(row);
        return row;
      }),
    },
  },
}));

import { POST } from "@/app/api/contact/route";
import {
  CONTACT_GLOBAL_HOURLY_CAP,
  CONTACT_MAX_BODY_BYTES,
  CONTACT_RATE_LIMIT,
  CONTACT_RATE_LIMIT_NO_IP,
  contactTopicFromParam,
  validateContact,
} from "@/lib/contact/validation";

const SECRET_BODY = "We need SSO for 40 agents by March. Budget is private.";
const savedEnv: Record<string, string | undefined> = {};
let ipSeq = 0;

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: "Asha Rao",
    email: "asha@example.com",
    company: "Rao Clinics",
    teamSize: "6-20",
    topic: "enterprise",
    message: SECRET_BODY,
    website: "",
    ...overrides,
  };
}

function contactRequest(
  body: unknown,
  ip: string | null = `198.51.100.${++ipSeq}`,
  extraHeaders: Record<string, string> = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  return new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function seedRows(count: number, createdAt: Date) {
  for (let i = 0; i < count; i++) {
    store.contactMessages.push({ id: `seed_${i}`, createdAt, email: "seed@example.com" });
  }
}

beforeEach(() => {
  for (const key of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "VERCEL",
    "TRUSTED_PROXY_HOPS",
    "APP_URL",
  ]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  // Behave like a host with one trusted proxy, so the right-most XFF entry is the client.
  process.env.TRUSTED_PROXY_HOPS = "1";
  store.contactMessages = [];
  store.failNextCreate = false;
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("validateContact", () => {
  it("accepts a full message and trims it", () => {
    const result = validateContact(valid({ name: "  Asha Rao  " }));
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Asha Rao",
        email: "asha@example.com",
        company: "Rao Clinics",
        teamSize: "6-20",
        topic: "enterprise",
        message: SECRET_BODY,
      },
    });
  });

  it("treats empty optional fields as absent and defaults the topic", () => {
    const result = validateContact({
      name: "Asha",
      email: "asha@example.com",
      company: "",
      teamSize: "",
      message: "Hello, a short question.",
    });
    expect(result.ok && result.data).toMatchObject({
      company: undefined,
      teamSize: undefined,
      topic: "enterprise",
    });
  });

  it("names each bad field with a readable message", () => {
    const result = validateContact({
      name: "",
      email: "not-an-email",
      teamSize: "lots",
      topic: "billing",
      message: "hi",
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: "Enter your name.",
        email: "Enter a valid email, like name@company.com.",
        teamSize: "Choose a team size from the list.",
        topic: "Choose a topic from the list.",
        message: "Write at least 10 characters.",
      },
    });
  });

  it("enforces length limits", () => {
    const result = validateContact(
      valid({ name: "a".repeat(101), company: "c".repeat(121), message: "m".repeat(2001) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(["company", "message", "name"]);
    }
  });

  it("reads the topic from ?topic= and falls back to enterprise", () => {
    expect(contactTopicFromParam("general")).toBe("general");
    expect(contactTopicFromParam(["enterprise", "general"])).toBe("enterprise");
    expect(contactTopicFromParam("<script>")).toBe("enterprise");
    expect(contactTopicFromParam(undefined)).toBe("enterprise");
  });
});

describe("POST /api/contact", () => {
  it("stores a valid message and returns 201", async () => {
    const response = await POST(contactRequest(valid()));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(store.contactMessages).toHaveLength(1);
    expect(store.contactMessages[0]).toMatchObject({
      name: "Asha Rao",
      email: "asha@example.com",
      company: "Rao Clinics",
      teamSize: "6-20",
      topic: "ENTERPRISE",
      message: SECRET_BODY,
    });
    expect(store.contactMessages[0]).not.toHaveProperty("website");
  });

  it("returns 400 with field errors for an invalid email and stores nothing", async () => {
    const response = await POST(contactRequest(valid({ email: "asha@" })));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors).toEqual({
      email: "Enter a valid email, like name@company.com.",
    });
    expect(store.contactMessages).toHaveLength(0);
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await POST(contactRequest("{nope"));
    expect(response.status).toBe(400);
    expect(store.contactMessages).toHaveLength(0);
  });

  it("answers a filled honeypot exactly like a real save but stores nothing", async () => {
    const real = await POST(contactRequest(valid()));
    const bot = await POST(contactRequest(valid({ website: "https://spam.example" })));
    expect(bot.status).toBe(201);
    expect(bot.status).toBe(real.status);
    expect(await bot.json()).toEqual(await real.json());
    expect(store.contactMessages).toHaveLength(1);
  });

  it("keys the limit on the trusted right-most hop, so a spoofed x-forwarded-for does not help", async () => {
    const proxySeen = "203.0.113.77";
    for (let i = 0; i < CONTACT_RATE_LIMIT.limit; i++) {
      const response = await POST(contactRequest("{bad", `10.9.9.${i}, ${proxySeen}`));
      expect(response.status).toBe(400);
    }
    const spoofed = await POST(contactRequest(valid(), `10.9.9.250, ${proxySeen}`));
    expect(spoofed.status).toBe(429);
    expect(store.contactMessages).toHaveLength(0);
  });

  it("on Vercel uses x-real-ip and ignores x-forwarded-for", async () => {
    process.env.VERCEL = "1";
    delete process.env.TRUSTED_PROXY_HOPS;
    for (let i = 0; i < CONTACT_RATE_LIMIT.limit; i++) {
      const response = await POST(
        contactRequest("{bad", `10.8.8.${i}`, { "x-real-ip": "192.0.2.40" }),
      );
      expect(response.status).toBe(400);
    }
    const spoofed = await POST(
      contactRequest(valid(), "10.8.8.250", { "x-real-ip": "192.0.2.40" }),
    );
    expect(spoofed.status).toBe(429);
    const other = await POST(
      contactRequest(valid(), "10.8.8.250", { "x-real-ip": "192.0.2.41" }),
    );
    expect(other.status).toBe(201);
  });

  it("puts requests with no trusted IP in a looser shared bucket", async () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(CONTACT_RATE_LIMIT_NO_IP.limit).toBeGreaterThan(CONTACT_RATE_LIMIT.limit);
    // Past the per-IP limit, still allowed: the forged XFF values are ignored.
    for (let i = 0; i < CONTACT_RATE_LIMIT.limit + 1; i++) {
      const response = await POST(contactRequest("{bad", `10.7.7.${i}`));
      expect(response.status).toBe(400);
    }
    for (let i = CONTACT_RATE_LIMIT.limit + 1; i < CONTACT_RATE_LIMIT_NO_IP.limit; i++) {
      expect((await POST(contactRequest("{bad", null))).status).toBe(400);
    }
    const limited = await POST(contactRequest(valid(), null));
    expect(limited.status).toBe(429);
  });

  it("returns 429 once the global hourly cap of stored messages is reached", async () => {
    seedRows(CONTACT_GLOBAL_HOURLY_CAP, new Date());
    const response = await POST(contactRequest(valid()));
    expect(response.status).toBe(429);
    expect((await response.json()).error).toMatch(/try again/i);
    expect(store.contactMessages).toHaveLength(CONTACT_GLOBAL_HOURLY_CAP);
  });

  it("does not count messages older than an hour toward the global cap", async () => {
    seedRows(CONTACT_GLOBAL_HOURLY_CAP, new Date(Date.now() - 2 * 60 * 60 * 1000));
    const response = await POST(contactRequest(valid()));
    expect(response.status).toBe(201);
  });

  it("returns 413 when content-length is over the limit", async () => {
    const response = await POST(
      contactRequest(valid(), undefined, {
        "content-length": String(CONTACT_MAX_BODY_BYTES + 1),
      }),
    );
    expect(response.status).toBe(413);
    expect(store.contactMessages).toHaveLength(0);
  });

  it("returns 413 while reading a large body that has no content-length", async () => {
    const big = JSON.stringify(valid({ message: "m".repeat(CONTACT_MAX_BODY_BYTES) }));
    const request = contactRequest(big);
    expect(request.headers.get("content-length")).toBeNull();
    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(store.contactMessages).toHaveLength(0);
  });

  it("returns 415 for a content type other than application/json", async () => {
    const response = await POST(
      contactRequest(JSON.stringify(valid()), undefined, { "Content-Type": "text/plain" }),
    );
    expect(response.status).toBe(415);
    expect(store.contactMessages).toHaveLength(0);
  });

  it("returns 403 for a cross-site browser post", async () => {
    const byOrigin = await POST(
      contactRequest(valid(), undefined, { Origin: "https://evil.example" }),
    );
    expect(byOrigin.status).toBe(403);
    const byFetchSite = await POST(
      contactRequest(valid(), undefined, { "Sec-Fetch-Site": "cross-site" }),
    );
    expect(byFetchSite.status).toBe(403);
    expect(store.contactMessages).toHaveLength(0);
  });

  it("allows a same-origin browser post and a post with no Origin", async () => {
    const sameOrigin = await POST(
      contactRequest(valid(), undefined, {
        Origin: "http://localhost:3000",
        "Sec-Fetch-Site": "same-origin",
      }),
    );
    expect(sameOrigin.status).toBe(201);
    const noOrigin = await POST(contactRequest(valid()));
    expect(noOrigin.status).toBe(201);
  });

  it("rate-limits one IP after the limit", async () => {
    const ip = "203.0.113.99";
    for (let i = 0; i < CONTACT_RATE_LIMIT.limit; i++) {
      const ok = await POST(contactRequest(valid(), ip));
      expect(ok.status).toBe(201);
    }
    const limited = await POST(contactRequest(valid(), ip));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error).toMatch(/try again/i);
    expect(store.contactMessages).toHaveLength(CONTACT_RATE_LIMIT.limit);

    // Another IP is not affected.
    const other = await POST(contactRequest(valid(), "203.0.113.100"));
    expect(other.status).toBe(201);
  });

  it("returns a friendly 503 when the database fails, without logging the message", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    store.failNextCreate = true;

    const response = await POST(contactRequest(valid()));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe(
      "We couldn't save your message right now. Please try again in a few minutes.",
    );
    expect(store.contactMessages).toHaveLength(0);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("ECONNREFUSED");
    expect(logged).not.toContain(SECRET_BODY);
    expect(logged).not.toContain("asha@example.com");
  });
});
