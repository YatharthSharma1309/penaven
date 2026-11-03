import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimitMemory,
  clientIpBucket,
  getClientIp,
  NO_TRUSTED_IP_BUCKET,
} from "./rate-limit";

describe("checkRateLimitMemory", () => {
  it("does not rate limit the first request in a window", () => {
    const key = `test-first-${Date.now()}`;

    expect(checkRateLimitMemory(key, 2, 60_000)).toBe(false);
  });

  it("rate limits after the limit is reached", () => {
    const key = `test-limit-${Date.now()}`;

    expect(checkRateLimitMemory(key, 2, 60_000)).toBe(false);
    expect(checkRateLimitMemory(key, 2, 60_000)).toBe(false);
    expect(checkRateLimitMemory(key, 2, 60_000)).toBe(true);
  });

  it("resets the bucket after the window expires", () => {
    vi.useFakeTimers();
    const key = `test-reset-${Date.now()}`;

    expect(checkRateLimitMemory(key, 1, 10_000)).toBe(false);
    expect(checkRateLimitMemory(key, 1, 10_000)).toBe(true);

    vi.advanceTimersByTime(11_000);

    expect(checkRateLimitMemory(key, 1, 10_000)).toBe(false);
    vi.useRealTimers();
  });
});

describe("getClientIp", () => {
  it("reads the first x-forwarded-for address", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });

    expect(getClientIp(request)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.2" },
    });

    expect(getClientIp(request)).toBe("198.51.100.2");
  });

  it("returns unknown when no IP headers are present", () => {
    const request = new Request("http://localhost");

    expect(getClientIp(request)).toBe("unknown");
  });
});

describe("clientIpBucket", () => {
  const forged = (ip: string) =>
    new Request("http://localhost", {
      headers: { "x-forwarded-for": ip, "x-real-ip": ip },
    });

  afterEach(() => vi.unstubAllEnvs());

  it("uses the trusted IP on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    expect(clientIpBucket(forged("203.0.113.1"))).toBe("203.0.113.1");
  });

  it("shares one bucket when no IP can be trusted, whatever the client sends", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "");
    expect(clientIpBucket(forged("192.0.2.1"))).toBe(NO_TRUSTED_IP_BUCKET);
    expect(clientIpBucket(forged("192.0.2.2"))).toBe(NO_TRUSTED_IP_BUCKET);
  });
});
