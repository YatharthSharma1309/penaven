import { Redis } from "@upstash/redis";

const buckets = new Map<string, { count: number; resetAt: number }>();

let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (bucket.count >= limit) {
    return true;
  }

  bucket.count += 1;
  return false;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const redis = getRedisClient();

  if (!redis) {
    return checkRateLimitMemory(key, limit, windowMs);
  }

  try {
    const windowSec = Math.ceil(windowMs / 1000);
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);

    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }

    return count > limit;
  } catch (error) {
    console.error("Redis rate limit failed, using in-memory fallback:", error);
    return checkRateLimitMemory(key, limit, windowMs);
  }
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Client IP from a source the client cannot forge, or null when there is none.
 * `getClientIp` above trusts the first `x-forwarded-for` entry, which any
 * client can set; it is left as is for its existing callers.
 *
 * - Vercel (where this app deploys, see DEPLOY.md): the edge overwrites
 *   `x-real-ip` and sets `x-vercel-forwarded-for` itself, so read those.
 * - Behind another proxy (for example Cloud Run's load balancer), set
 *   `TRUSTED_PROXY_HOPS` to the number of proxies in front of the app. Each
 *   proxy appends the address it saw, so the entry that many places from the
 *   right is the one the outermost trusted proxy recorded.
 * - Anywhere else (local dev, `next start` with no proxy) every forwarding
 *   header comes straight from the client, so no IP is trusted.
 */
export function getTrustedClientIp(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const headers = request.headers;

  if (env.VERCEL === "1") {
    const ip =
      headers.get("x-real-ip")?.trim() ||
      headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    return ip || null;
  }

  const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "", 10);
  if (Number.isInteger(hops) && hops > 0) {
    const chain = (headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return chain.length >= hops ? chain[chain.length - hops] : null;
  }

  return null;
}
