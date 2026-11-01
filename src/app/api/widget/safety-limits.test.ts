import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drives the real public chat routes with Prisma and the model faked, to show
 * the limits sit in the right place in each route.
 */

const state = vi.hoisted(() => ({ answersThisMonth: 0, answersToday: 0, orgId: "" }));

vi.mock("@/lib/db", () => ({
  db: {
    organization: {
      findFirst: vi.fn(async () => ({
        id: state.orgId,
        widgetEnabled: true,
        settings: null,
      })),
    },
    conversation: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "conv_1" })),
      update: vi.fn(async () => ({ id: "conv_1" })),
    },
    message: {
      count: vi.fn(async ({ where }) => {
        const dayOfMonth = where.createdAt.gte.getUTCDate();
        return dayOfMonth === 1 ? state.answersThisMonth : state.answersToday;
      }),
      create: vi.fn(async () => ({ id: "msg_1" })),
    },
  },
}));

vi.mock("@/lib/chat/stream-handler", () => ({
  createChatStreamResponse: vi.fn(
    async () => new Response("event: done\n\n", { status: 200 }),
  ),
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  requireOrgMembership: vi.fn(async () => ({
    organization: { id: state.orgId },
    role: "AGENT",
  })),
}));

vi.mock("@/lib/chat/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat/service")>()),
  prepareChatTurn: vi.fn(async () => ({ conversationId: "conv_1", userMessageId: "msg_1" })),
  generateChatReply: vi.fn(async () => "An answer"),
  saveAssistantMessage: vi.fn(async () => ({ id: "msg_2" })),
  prepareSandboxChatTurn: vi.fn(async () => {
    throw new Error("the model path must not run for a demo sandbox turn");
  }),
}));

import { POST as chatPOST } from "@/app/api/chat/route";
import { POST as chatStreamPOST } from "@/app/api/chat/stream/route";
import { POST as feedbackPOST } from "@/app/api/widget/messages/[id]/feedback/route";
import { POST as sessionPOST } from "@/app/api/widget/session/route";
import { POST as widgetStreamPOST } from "@/app/api/widget/chat/stream/route";
import { POST as ticketsPOST } from "@/app/api/widget/tickets/route";
import { createVisitorToken } from "@/lib/auth/widget-visitor";
import {
  SAFETY_ANSWERS_PER_IP_PER_DAY,
  SAFETY_DEMO_ANSWERS_PER_DAY,
} from "@/lib/billing/abuse-limits";
import { PLANS } from "@/lib/billing/plans";
import { createChatStreamResponse } from "@/lib/chat/stream-handler";
import { db } from "@/lib/db";

const VISITOR_ID = "3f2b8c1a-1d2e-4c3b-9a8f-0123456789ab";
let orgSeq = 0;

function post(path: string, body: Record<string, unknown>, headers: Record<string, string>) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": "wk_test",
      Origin: "http://localhost:3000",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const askWidget = (headers: Record<string, string>) =>
  widgetStreamPOST(
    post(
      "/api/widget/chat/stream",
      {
        message: "Where is my order?",
        visitorId: VISITOR_ID,
        visitorToken: createVisitorToken(state.orgId, VISITOR_ID),
      },
      headers,
    ),
  );

const askAdmin = (
  route: typeof chatPOST | typeof chatStreamPOST,
  headers: Record<string, string>,
  sandbox = false,
) => route(post("/api/chat", { message: "Refund policy?", sandbox }, headers));

beforeEach(() => {
  state.orgId = `org_routes_${++orgSeq}`;
  state.answersThisMonth = 0;
  state.answersToday = 0;
  vi.mocked(createChatStreamResponse).mockClear();
  vi.mocked(db.message.create).mockClear();
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("TRUSTED_PROXY_HOPS", "");
  vi.stubEnv("PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.useFakeTimers({ now: new Date("2026-11-15T12:00:00.000Z"), toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Spaced out so only the daily limit is in play, not the per-minute one. */
async function askAllowance(ask: () => Promise<Response>) {
  for (let i = 0; i < SAFETY_ANSWERS_PER_IP_PER_DAY; i += 1) {
    expect((await ask()).status).toBe(200);
    vi.setSystemTime(Date.now() + 61_000);
  }
}

describe("widget chat", () => {
  it("returns the existing 429 on answer 21 and never reaches the model", async () => {
    const ask = () => askWidget({ "x-real-ip": "203.0.113.40" });
    await askAllowance(ask);
    vi.mocked(db.message.create).mockClear();

    const response = await ask();

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Rate limit exceeded" });
    expect(createChatStreamResponse).toHaveBeenCalledTimes(SAFETY_ANSWERS_PER_IP_PER_DAY);
    expect(db.message.create).not.toHaveBeenCalled();
  });

  it("is not fooled by a fresh x-forwarded-for on each request", async () => {
    let seq = 0;
    const ask = () =>
      askWidget({ "x-real-ip": "203.0.113.41", "x-forwarded-for": `192.0.2.${++seq}` });
    await askAllowance(ask);
    expect((await ask()).status).toBe(429);
  });

  it("is not fooled by forged headers with no trusted proxy", async () => {
    vi.stubEnv("VERCEL", "");
    let seq = 0;
    const ask = () => askWidget({ "x-forwarded-for": `192.0.2.${++seq}` });
    await askAllowance(ask);
    expect((await ask()).status).toBe(429);
  });

  it("still gives the cap hand-off, not a 429, once the month is used", async () => {
    const ask = () => askWidget({ "x-real-ip": "203.0.113.42" });
    await askAllowance(ask);

    state.answersThisMonth = PLANS.free.assistantAnswersPerMonth;
    const response = await ask();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("stops at the demo ceiling across different IPs", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    expect((await askWidget({ "x-real-ip": "203.0.113.43" })).status).toBe(200);

    state.answersToday = SAFETY_DEMO_ANSWERS_PER_DAY;
    expect((await askWidget({ "x-real-ip": "203.0.113.44" })).status).toBe(429);
  });

  it("has no workspace ceiling outside the demo", async () => {
    state.answersToday = SAFETY_DEMO_ANSWERS_PER_DAY * 2;
    expect((await askWidget({ "x-real-ip": "203.0.113.45" })).status).toBe(200);
  });
});

describe.each([
  ["/api/chat", chatPOST],
  ["/api/chat/stream", chatStreamPOST],
])("admin chat %s", (_path, route) => {
  it("is limited per IP in the demo", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    const ask = () => askAdmin(route, { "x-real-ip": "203.0.113.50" });
    await askAllowance(ask);
    expect((await ask()).status).toBe(429);
  });

  it("is limited by the demo ceiling", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    state.answersToday = SAFETY_DEMO_ANSWERS_PER_DAY;
    expect((await askAdmin(route, { "x-real-ip": "203.0.113.51" })).status).toBe(429);
  });

  it("refuses a sandbox turn in the demo", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    const response = await askAdmin(route, { "x-real-ip": "203.0.113.52" }, true);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("DEMO_READ_ONLY");
  });

  it("has no daily limit for a signed-in workspace", async () => {
    const ask = () => askAdmin(route, { "x-real-ip": "203.0.113.53" });
    await askAllowance(ask);
    expect((await ask()).status).toBe(200);
  });
});

describe("other widget routes ignore a forged x-forwarded-for", () => {
  const forged = (i: number) => ({ "x-real-ip": "203.0.113.60", "x-forwarded-for": `192.0.2.${i}` });

  async function statusesAfter(limit: number, send: (i: number) => Promise<Response>) {
    for (let i = 0; i < limit; i += 1) await send(i);
    return (await send(limit)).status;
  }

  it("session", async () => {
    const status = await statusesAfter(30, (i) =>
      sessionPOST(post("/api/widget/session", {}, forged(i))),
    );
    expect(status).toBe(429);
  });

  it("tickets", async () => {
    const status = await statusesAfter(10, (i) =>
      ticketsPOST(post("/api/widget/tickets", {}, forged(i))),
    );
    expect(status).toBe(429);
  });

  it("feedback", async () => {
    const status = await statusesAfter(60, (i) =>
      feedbackPOST(post("/api/widget/messages/m1/feedback", {}, forged(i)), {
        params: Promise.resolve({ id: "m1" }),
      }),
    );
    expect(status).toBe(429);
  });

  it("session shares one bucket when no IP can be trusted", async () => {
    vi.stubEnv("VERCEL", "");
    const status = await statusesAfter(30, (i) =>
      sessionPOST(
        post("/api/widget/session", {}, { "x-forwarded-for": `192.0.2.${i}` }),
      ),
    );
    expect(status).toBe(429);
  });
});
