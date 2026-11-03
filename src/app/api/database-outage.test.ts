import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

/**
 * Drives the real route handlers with a database that fails every call, and
 * checks what a person actually receives.
 */

const SECRET = "customer-secret@example.test";
const CLEAN = "The service is temporarily unavailable. Please try again shortly.";

function outage() {
  return new Prisma.PrismaClientKnownRequestError(`Failed with ${SECRET}`, {
    code: "P1001",
    clientVersion: "7.8.0",
    meta: { modelName: "Message" },
  });
}

const mocks = vi.hoisted(() => ({
  requireOrgMembership: vi.fn(),
  prepareChatTurn: vi.fn(),
  generateChatReply: vi.fn(),
  saveAssistantMessage: vi.fn(),
  dbCall: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const model = new Proxy({}, { get: () => mocks.dbCall });
  return { db: new Proxy({}, { get: () => model }) };
});

vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  authErrorResponse: () => null,
  getOrgMembershipContext: vi.fn(),
  requireOrgMembership: mocks.requireOrgMembership,
  requireOrgMembershipOrRedirect: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => false),
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/billing/usage", () => ({
  assistantAnswersCapped: vi.fn(async () => false),
}));

vi.mock("@/lib/chat/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat/service")>()),
  prepareChatTurn: mocks.prepareChatTurn,
  generateChatReply: mocks.generateChatReply,
  saveAssistantMessage: mocks.saveAssistantMessage,
}));

function post(path: string, body: Record<string, unknown> = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-widget-key": "wk_live_test",
    },
    body: JSON.stringify(body),
  });
}

let errorLog: ReturnType<typeof vi.spyOn>;

async function expectCleanOutage(response: Response) {
  const text = await response.text();

  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toBe("5");
  expect(JSON.parse(text).error).toBe(CLEAN);
  expect(text).not.toContain(SECRET);
  expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
  expect(errorLog).toHaveBeenCalledWith("Database error", {
    code: "P1001",
    model: "Message",
    status: 503,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.dbCall.mockImplementation(async () => {
    throw outage();
  });
  mocks.requireOrgMembership.mockResolvedValue({
    organization: { id: "org_1" },
    user: { id: "user_1" },
    role: "ADMIN",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("widget routes in an outage", () => {
  it("chat stream", async () => {
    const { POST } = await import("@/app/api/widget/chat/stream/route");
    await expectCleanOutage(
      await POST(post("/api/widget/chat/stream", { message: "Hello" })),
    );
  });

  it("tickets", async () => {
    const { POST } = await import("@/app/api/widget/tickets/route");
    await expectCleanOutage(await POST(post("/api/widget/tickets", {})));
  });

  it("session", async () => {
    const { POST } = await import("@/app/api/widget/session/route");
    await expectCleanOutage(await POST(post("/api/widget/session", {})));
  });

  it("feedback", async () => {
    const { POST } = await import("@/app/api/widget/messages/[id]/feedback/route");
    await expectCleanOutage(
      await POST(post("/api/widget/messages/m1/feedback", {}), {
        params: Promise.resolve({ id: "m1" }),
      }),
    );
  });
});

describe("staff routes in an outage", () => {
  it("chat, when the failure is at sign-in", async () => {
    mocks.requireOrgMembership.mockRejectedValueOnce(outage());
    const { POST } = await import("@/app/api/chat/route");
    await expectCleanOutage(await POST(post("/api/chat", { message: "Hello" })));
  });

  it("chat, when the rollback fails too", async () => {
    mocks.prepareChatTurn.mockResolvedValue({
      conversationId: "conv_1",
      userMessageId: "msg_1",
      rankedChunks: [],
      fallbackReply: "fallback",
      sources: [],
    });
    mocks.generateChatReply.mockResolvedValue("A reply");
    mocks.saveAssistantMessage.mockRejectedValue(outage());

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(post("/api/chat", { message: "Hello" }));
    const body = await response.clone().json();

    expect(body.conversationId).toBe("conv_1");
    await expectCleanOutage(response);
  });

  it("chat stream", async () => {
    mocks.requireOrgMembership.mockRejectedValueOnce(outage());
    const { POST } = await import("@/app/api/chat/stream/route");
    await expectCleanOutage(
      await POST(post("/api/chat/stream", { message: "Hello" })),
    );
  });
});

describe("errors that are not database failures", () => {
  it("keep the widget stream's own reply", async () => {
    mocks.dbCall.mockRejectedValue(new Error("Something else"));
    const { POST } = await import("@/app/api/widget/chat/stream/route");
    const response = await POST(post("/api/widget/chat/stream", { message: "Hello" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "Chat is unavailable right now. Please try again.",
    });
  });

  it("keep the staff chat reply", async () => {
    mocks.requireOrgMembership.mockRejectedValueOnce(new Error("Something else"));
    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(post("/api/chat", { message: "Hello" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "Chat request failed. Check the database and try again.",
    });
  });
});
