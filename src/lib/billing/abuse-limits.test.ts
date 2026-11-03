import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const messageCount = vi.hoisted(() => vi.fn(async () => 0));

vi.mock("@/lib/db", () => ({ db: { message: { count: messageCount } } }));

import {
  answerSafetyLimitReached,
  countAnswersToday,
  demoAdminChatRefusal,
  SAFETY_ANSWERS_PER_IP_PER_DAY,
  SAFETY_DEMO_ANSWERS_PER_DAY,
  startOfUtcDay,
} from "./abuse-limits";
import { PLANS } from "./plans";

let orgSeq = 0;
const newOrg = () => `org_limits_${++orgSeq}`;

function vercelRequest(ip: string, forwardedFor = "198.51.100.1") {
  return new Request("http://localhost/api/widget/chat/stream", {
    method: "POST",
    headers: { "x-real-ip": ip, "x-forwarded-for": forwardedFor },
  });
}

/** Uses up the IP's allowance. Each call must pass until the last. */
async function exhaust(request: Request, org: string, now: Date) {
  for (let i = 0; i < SAFETY_ANSWERS_PER_IP_PER_DAY; i += 1) {
    expect(await answerSafetyLimitReached(request, org, now)).toBe(false);
  }
}

beforeEach(() => {
  messageCount.mockReset();
  messageCount.mockResolvedValue(0);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("TRUSTED_PROXY_HOPS", "");
  vi.stubEnv("PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("named safety defaults", () => {
  it("are the agreed numbers", () => {
    expect(SAFETY_ANSWERS_PER_IP_PER_DAY).toBe(20);
    expect(SAFETY_DEMO_ANSWERS_PER_DAY).toBe(300);
  });

  it("leave the published plan caps alone", () => {
    expect(PLANS.free.assistantAnswersPerMonth).toBe(40);
    expect(PLANS.pro.assistantAnswersPerMonth).toBe(250);
    expect(PLANS.pro.priceUsd).toBe(39);
  });
});

describe("per-IP limit", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");

  it("stops the 21st answer of the day", async () => {
    const org = newOrg();
    await exhaust(vercelRequest("203.0.113.10"), org, now);
    expect(await answerSafetyLimitReached(vercelRequest("203.0.113.10"), org, now)).toBe(true);
  });

  it("does not spend a Free workspace's month in one sitting", () => {
    expect(SAFETY_ANSWERS_PER_IP_PER_DAY).toBeLessThan(PLANS.free.assistantAnswersPerMonth);
  });

  it("keeps other IPs and other workspaces apart", async () => {
    const org = newOrg();
    await exhaust(vercelRequest("203.0.113.11"), org, now);
    expect(await answerSafetyLimitReached(vercelRequest("203.0.113.12"), org, now)).toBe(false);
    expect(await answerSafetyLimitReached(vercelRequest("203.0.113.11"), newOrg(), now)).toBe(false);
  });

  it("ignores a spoofed x-forwarded-for on Vercel", async () => {
    const org = newOrg();
    for (let i = 0; i < SAFETY_ANSWERS_PER_IP_PER_DAY; i += 1) {
      const request = vercelRequest("203.0.113.13", `192.0.2.${i}`);
      expect(await answerSafetyLimitReached(request, org, now)).toBe(false);
    }
    const spoofed = vercelRequest("203.0.113.13", "192.0.2.250");
    expect(await answerSafetyLimitReached(spoofed, org, now)).toBe(true);
  });

  it("puts everyone in one bucket when no IP can be trusted", async () => {
    vi.stubEnv("VERCEL", "");
    const org = newOrg();
    const forged = (i: number) =>
      new Request("http://localhost", { headers: { "x-forwarded-for": `192.0.2.${i}` } });

    for (let i = 0; i < SAFETY_ANSWERS_PER_IP_PER_DAY; i += 1) {
      expect(await answerSafetyLimitReached(forged(i), org, now)).toBe(false);
    }
    expect(await answerSafetyLimitReached(forged(99), org, now)).toBe(true);
  });

  it("resets at UTC midnight, not 24 hours later", async () => {
    const org = newOrg();
    const beforeMidnight = new Date("2026-11-01T23:59:00.000Z");
    vi.useFakeTimers({ now: beforeMidnight });
    await exhaust(vercelRequest("203.0.113.14"), org, beforeMidnight);
    expect(
      await answerSafetyLimitReached(vercelRequest("203.0.113.14"), org, beforeMidnight),
    ).toBe(true);

    const afterMidnight = new Date("2026-11-02T00:01:00.000Z");
    vi.setSystemTime(afterMidnight);
    expect(
      await answerSafetyLimitReached(vercelRequest("203.0.113.14"), org, afterMidnight),
    ).toBe(false);
  });

  it("does not count the day's total for a real workspace", async () => {
    const org = newOrg();
    messageCount.mockResolvedValue(10_000);
    expect(await answerSafetyLimitReached(vercelRequest("203.0.113.15"), org, now)).toBe(false);
    expect(messageCount).not.toHaveBeenCalled();
  });
});

describe("demo workspace ceiling", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");

  beforeEach(() => vi.stubEnv("PUBLIC_DEMO_MODE", "true"));

  it("allows answer 300 and stops answer 301", async () => {
    const org = newOrg();
    messageCount.mockResolvedValue(SAFETY_DEMO_ANSWERS_PER_DAY - 1);
    expect(await answerSafetyLimitReached(vercelRequest("203.0.113.20"), org, now)).toBe(false);

    messageCount.mockResolvedValue(SAFETY_DEMO_ANSWERS_PER_DAY);
    expect(await answerSafetyLimitReached(vercelRequest("203.0.113.21"), org, now)).toBe(true);
  });

  it("does not use up an IP's answers while the ceiling is hit", async () => {
    const org = newOrg();
    const request = vercelRequest("203.0.113.22");
    messageCount.mockResolvedValue(SAFETY_DEMO_ANSWERS_PER_DAY);
    for (let i = 0; i < SAFETY_ANSWERS_PER_IP_PER_DAY + 5; i += 1) {
      await answerSafetyLimitReached(request, org, now);
    }
    messageCount.mockResolvedValue(0);
    expect(await answerSafetyLimitReached(request, org, now)).toBe(false);
  });

  it("counts stored USER messages for this workspace since UTC midnight", async () => {
    await countAnswersToday("org_demo", new Date("2026-11-01T23:30:00.000+05:30"));
    expect(messageCount).toHaveBeenCalledWith({
      where: {
        role: "USER",
        createdAt: { gte: new Date("2026-11-01T00:00:00.000Z") },
        conversation: { organizationId: "org_demo" },
      },
    });
  });

  it("opens again on the next UTC day", async () => {
    messageCount.mockImplementation(async (args?: unknown) => {
      const { where } = args as { where: { createdAt: { gte: Date } } };
      return where.createdAt.gte.getTime() === startOfUtcDay(now).getTime()
        ? SAFETY_DEMO_ANSWERS_PER_DAY
        : 0;
    });
    const org = newOrg();
    const request = vercelRequest("203.0.113.23");

    expect(await answerSafetyLimitReached(request, org, now)).toBe(true);
    expect(
      await answerSafetyLimitReached(request, org, new Date("2026-11-02T00:00:01.000Z")),
    ).toBe(false);
  });

  it("fails closed when the count fails", async () => {
    messageCount.mockRejectedValue(new Error("db down"));
    await expect(
      answerSafetyLimitReached(vercelRequest("203.0.113.24"), newOrg(), now),
    ).rejects.toThrow("db down");
  });
});

describe("demoAdminChatRefusal", () => {
  it("does nothing outside the demo, so admin chat stays as it was", async () => {
    messageCount.mockResolvedValue(10_000);
    const request = vercelRequest("203.0.113.30");
    const org = newOrg();
    for (let i = 0; i < SAFETY_ANSWERS_PER_IP_PER_DAY + 5; i += 1) {
      expect(await demoAdminChatRefusal(request, org, true)).toBeNull();
    }
    expect(messageCount).not.toHaveBeenCalled();
  });

  it("refuses a sandbox turn in the demo, which the ceiling could not count", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    const response = await demoAdminChatRefusal(vercelRequest("203.0.113.31"), newOrg(), true);
    expect(response?.status).toBe(403);
    expect((await response?.json()).code).toBe("DEMO_READ_ONLY");
  });

  it("returns the existing 429 over a limit", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    messageCount.mockResolvedValue(SAFETY_DEMO_ANSWERS_PER_DAY);
    const response = await demoAdminChatRefusal(vercelRequest("203.0.113.32"), newOrg(), false);
    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({ error: "Rate limit exceeded" });
  });

  it("lets a normal demo turn through", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    expect(
      await demoAdminChatRefusal(vercelRequest("203.0.113.33"), newOrg(), false),
    ).toBeNull();
  });
});
