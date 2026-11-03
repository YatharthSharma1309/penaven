import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const SECRET = "customer-secret@example.test";

function outage() {
  return new Prisma.PrismaClientKnownRequestError(`Failed with ${SECRET}`, {
    code: "P1001",
    clientVersion: "7.8.0",
    meta: { modelName: "Message" },
  });
}

const mocks = vi.hoisted(() => ({
  prepareChatTurn: vi.fn(),
  streamChatReply: vi.fn(),
  saveAssistantMessage: vi.fn(),
  db: {
    executionRun: { create: vi.fn() },
    executionLogEntry: { create: vi.fn() },
    message: { delete: vi.fn(), count: vi.fn() },
    conversation: { delete: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

// rollbackFailedTurn stays real, so these tests cover it failing mid-outage.
vi.mock("@/lib/chat/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat/service")>()),
  prepareChatTurn: mocks.prepareChatTurn,
  streamChatReply: mocks.streamChatReply,
  saveAssistantMessage: mocks.saveAssistantMessage,
}));

import { rollbackFailedTurn } from "@/lib/chat/service";
import { createChatStreamResponse } from "@/lib/chat/stream-handler";

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.prepareChatTurn.mockResolvedValue({
    conversationId: "conv_1",
    userMessageId: "msg_1",
    rankedChunks: [],
    fallbackReply: "fallback",
    sources: [],
    retrievalMode: "keyword",
    chunksMatched: 0,
    confidence: "low",
  });
  mocks.streamChatReply.mockResolvedValue({ stream: null, reply: "A reply" });
  mocks.saveAssistantMessage.mockRejectedValue(outage());
  mocks.db.executionRun.create.mockResolvedValue({ id: "run_1" });
  mocks.db.executionLogEntry.create.mockReset().mockResolvedValue({});
  mocks.db.message.delete.mockReset().mockRejectedValue(outage());
  mocks.db.message.count.mockReset().mockRejectedValue(outage());
  mocks.db.conversation.delete.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function openStream() {
  return createChatStreamResponse({
    organizationId: "org_1",
    message: "Hello",
    conversationId: null,
    visitorId: "visitor_1",
    channel: "WIDGET",
  });
}

describe("a database failure during a widget stream", () => {
  it("still sends the visitor a clean error event and closes", async () => {
    mocks.db.executionLogEntry.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(outage());

    const text = await (await openStream()).text();

    expect(text).toContain("event: error");
    expect(text).toContain("Chat is unavailable right now. Please try again.");
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("event: done");
  });

  it("logs codes only", async () => {
    mocks.db.executionLogEntry.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(outage());

    await (await openStream()).text();

    expect(errorLog).toHaveBeenCalledWith("Database error", {
      code: "P1001",
      model: "Message",
      status: 503,
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
  });

  it("stores the code, not the raw message, in the run log", async () => {
    await (await openStream()).text();

    const entry = mocks.db.executionLogEntry.create.mock.calls.at(-1)![0];
    expect(entry.data.decision).toBe("llm_stream_error");
    expect(entry.data.metadata).toEqual({ error: "P1001" });
  });

  it("keeps the raw message in the run log for an AI failure", async () => {
    mocks.saveAssistantMessage.mockRejectedValue(new Error("Model stream broke"));

    await (await openStream()).text();

    const entry = mocks.db.executionLogEntry.create.mock.calls.at(-1)![0];
    expect(entry.data.metadata).toEqual({ error: "Model stream broke" });
  });
});

describe("rollbackFailedTurn in an outage", () => {
  it("does not throw over the caller's own error handling", async () => {
    await expect(rollbackFailedTurn("conv_1", "msg_1")).resolves.toBeUndefined();

    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
    expect(errorLog).toHaveBeenCalledWith("Database error", {
      code: "P1001",
      model: "Message",
      status: 503,
    });
  });

  it("still removes an empty conversation when the database is healthy", async () => {
    mocks.db.message.delete.mockResolvedValue({});
    mocks.db.message.count.mockResolvedValue(0);

    await rollbackFailedTurn("conv_1", "msg_1");

    expect(mocks.db.conversation.delete).toHaveBeenCalledWith({
      where: { id: "conv_1" },
    });
  });
});
