import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The monthly cap race on real Postgres, through the real widget route.
 * Skipped unless ANSWER_CAP_TEST_DATABASE_URL names a migrated local database:
 *
 *   ANSWER_CAP_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5544/postgres npx vitest run answer-cap
 *
 * It creates its own workspace and removes it. No AI key is set, so no model runs.
 */
const databaseUrl = process.env.ANSWER_CAP_TEST_DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(databaseUrl);

const PARALLEL = 150;
const VISITOR_ID = "3f2b8c1a-1d2e-4c3b-9a8f-0123456789ab";

describe.skipIf(!isLocal)("monthly cap on real Postgres", () => {
  const slug = `cap-race-${Date.now()}`;
  const widgetKey = `wk_${slug}`;
  let organizationId = "";
  let db: typeof import("@/lib/db").db;
  let POST: typeof import("@/app/api/widget/chat/stream/route").POST;
  let visitorToken = "";

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", databaseUrl);
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
    vi.stubEnv("PUBLIC_DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    for (const key of ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY"]) {
      vi.stubEnv(key, "");
    }

    ({ db } = await import("@/lib/db"));
    ({ POST } = await import("@/app/api/widget/chat/stream/route"));
    const { createVisitorToken } = await import("@/lib/auth/widget-visitor");

    const organization = await db.organization.create({
      data: { name: "Cap race", slug, widgetPublicKey: widgetKey, widgetEnabled: true },
    });
    organizationId = organization.id;
    visitorToken = createVisitorToken(organizationId, VISITOR_ID);
  });

  afterAll(async () => {
    if (organizationId) {
      await db.organization.delete({ where: { id: organizationId } }).catch(() => null);
    }
    await db?.$disconnect();
    vi.unstubAllEnvs();
  });

  it("passes exactly 40 of 150 parallel widget questions", async () => {
    const responses = await Promise.all(
      Array.from({ length: PARALLEL }, (_, index) =>
        POST(
          new Request("http://127.0.0.1:3000/api/widget/chat/stream", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Widget-Key": widgetKey,
              Origin: "http://127.0.0.1:3000",
              // One trusted IP each, so only the monthly cap is in play.
              "x-real-ip": `198.18.${Math.floor(index / 250)}.${(index % 250) + 1}`,
            },
            body: JSON.stringify({
              message: `Question ${index}`,
              visitorId: VISITOR_ID,
              visitorToken,
            }),
          }),
        ),
      ),
    );

    const bodies = await Promise.all(responses.map((response) => response.text()));

    expect(responses.map((response) => response.status).filter((s) => s !== 200)).toEqual([]);
    const capped = bodies.filter((body) => body.includes('"retrievalMode":"monthly_cap"'));
    expect(capped).toHaveLength(PARALLEL - 40);
    expect(PARALLEL - capped.length).toBe(40);
  }, 60_000);
});
