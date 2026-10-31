import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drives the real widget stream and tickets route handlers for a Free
 * workspace that has used its monthly assistant answers. Prisma is an
 * in-memory fake so the full cap -> handoff path runs without a database.
 */

type Row = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  organizations: [] as Row[],
  conversations: [] as Row[],
  messages: [] as Row[],
  tickets: [] as Row[],
  userMessagesThisMonth: 0,
  seq: 0,
}));

vi.mock("@/lib/db", () => {
  const nextId = (prefix: string) => `${prefix}_${++store.seq}`;
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const condition = value as Record<string, unknown>;
        if ("startsWith" in condition) {
          return String(row[key]).startsWith(String(condition.startsWith));
        }
        if ("in" in condition) {
          return (condition.in as unknown[]).includes(row[key]);
        }
        return true;
      }
      return row[key] === value;
    });

  return {
    db: {
      organization: {
        findFirst: vi.fn(async ({ where }) =>
          store.organizations.find((row) => matches(row, where)) ?? null,
        ),
      },
      conversation: {
        findFirst: vi.fn(async ({ where }) =>
          store.conversations.find((row) => matches(row, where)) ?? null,
        ),
        create: vi.fn(async ({ data }) => {
          const row = { id: nextId("conv"), ...data };
          store.conversations.push(row);
          return row;
        }),
        update: vi.fn(async ({ where, data }) => {
          const row = store.conversations.find((item) => item.id === where.id)!;
          Object.assign(row, data);
          return row;
        }),
      },
      message: {
        // Counts only what usage.ts must ask for: USER messages in this
        // workspace since the start of the UTC month. Any other filter
        // counts 0, so the cap is not hit and the test fails.
        count: vi.fn(async ({ where }) => {
          const now = new Date();
          const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          const filterOk =
            where?.role === "USER" &&
            where?.createdAt?.gte instanceof Date &&
            where.createdAt.gte.getTime() === monthStart.getTime() &&
            where?.conversation?.organizationId === store.organizations[0]?.id;
          return filterOk ? store.userMessagesThisMonth : 0;
        }),
        create: vi.fn(async ({ data }) => {
          const row = { id: nextId("msg"), createdAt: new Date(), ...data };
          store.messages.push(row);
          return row;
        }),
      },
      ticket: {
        findFirst: vi.fn(async ({ where }) =>
          store.tickets.find((row) => matches(row, where)) ?? null,
        ),
        create: vi.fn(async ({ data }) => {
          const row = { id: nextId("ticket"), status: "OPEN", ...data };
          store.tickets.push(row);
          return row;
        }),
        update: vi.fn(async ({ where, data }) => {
          const row = store.tickets.find((item) => item.id === where.id)!;
          Object.assign(row, data);
          return row;
        }),
      },
      executionRun: { findFirst: vi.fn(async () => null) },
      executionLogEntry: { create: vi.fn() },
    },
  };
});

vi.mock("@/lib/chat/stream-handler", () => ({
  createChatStreamResponse: vi.fn(async () => {
    throw new Error("model path must not run once the cap is reached");
  }),
}));

import { POST as streamPOST } from "@/app/api/widget/chat/stream/route";
import { POST as ticketsPOST } from "@/app/api/widget/tickets/route";
import { createVisitorToken } from "@/lib/auth/widget-visitor";
import { PLANS, startOfUtcMonth } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { widgetAnswerState } from "@/lib/chat/answer-outcome";
import { createChatStreamResponse } from "@/lib/chat/stream-handler";

const ORG_ID = "org_free";
const WIDGET_KEY = "pk_cap_test";
const VISITOR_ID = "3f2b8c1a-1d2e-4c3b-9a8f-0123456789ab";
const AI_ENV = ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY"];
const savedEnv: Record<string, string | undefined> = {};

function widgetRequest(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": WIDGET_KEY,
      Origin: "http://localhost:3000",
      "x-forwarded-for": "203.0.113.7",
    },
    body: JSON.stringify(body),
  });
}

function parseSse(text: string) {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((part) => {
      const lines = part.split("\n");
      return {
        event: lines.find((l) => l.startsWith("event: "))!.slice(7),
        data: JSON.parse(lines.find((l) => l.startsWith("data: "))!.slice(6)),
      };
    });
}

beforeEach(() => {
  for (const key of [...AI_ENV, "PUBLIC_DEMO_MODE", "NEXT_PUBLIC_PUBLIC_DEMO_MODE", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  store.organizations = [
    { id: ORG_ID, widgetPublicKey: WIDGET_KEY, widgetEnabled: true, settings: null },
  ];
  store.conversations = [];
  store.messages = [];
  store.tickets = [];
  store.userMessagesThisMonth = PLANS.free.assistantAnswersPerMonth;
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("Free workspace at the monthly answer cap", () => {
  it("returns the cap reply, saves the thread, and a person can take it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const visitorToken = createVisitorToken(ORG_ID, VISITOR_ID);

    // 1. Stream route returns the cap reply without calling the model.
    const streamResponse = await streamPOST(
      widgetRequest("/api/widget/chat/stream", {
        message: "Can I change my delivery date?",
        visitorId: VISITOR_ID,
        visitorToken,
      }),
    );
    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get("Content-Type")).toBe("text/event-stream");
    expect(createChatStreamResponse).not.toHaveBeenCalled();
    expect(db.message.count).toHaveBeenCalledWith({
      where: {
        role: "USER",
        createdAt: { gte: startOfUtcMonth(new Date()) },
        conversation: { organizationId: ORG_ID },
      },
    });

    const events = parseSse(await streamResponse.text());
    expect(events.map((e) => e.event)).toEqual(["meta", "token", "done"]);
    const meta = events[0].data;
    const done = events[2].data;
    expect(meta.retrievalMode).toBe("monthly_cap");
    expect(done.reply).toContain("choose Ask a person");

    // 2. The conversation and both turns are saved.
    expect(store.conversations).toHaveLength(1);
    expect(store.conversations[0]).toMatchObject({
      id: meta.conversationId,
      organizationId: ORG_ID,
      visitorId: VISITOR_ID,
      channel: "WIDGET",
    });
    expect(store.messages.map((m) => m.role)).toEqual(["USER", "ASSISTANT"]);
    expect(store.messages[1].content).toBe(done.reply);

    // 3. The widget labels the reply needs_person; a conversationId is what
    //    enables "Ask a person to take this" (use-chat.ts canEscalate).
    expect(
      widgetAnswerState({ reply: done.reply, sourceCount: 0, retrievalMode: meta.retrievalMode }),
    ).toBe("needs_person");
    expect(typeof meta.conversationId).toBe("string");

    // 4. Tickets route (no cap check) creates an OPEN ticket; triage falls
    //    back to the heuristic because no model key is set.
    const ticketResponse = await ticketsPOST(
      widgetRequest("/api/widget/tickets", {
        title: "Escalation: Can I change my delivery date?",
        description: `user: Can I change my delivery date?\n\nassistant: ${done.reply}`,
        conversationId: meta.conversationId,
        priority: "HIGH",
        visitorId: VISITOR_ID,
        visitorToken,
        requesterEmail: "visitor@example.com",
      }),
    );
    expect(ticketResponse.status).toBe(200);
    const { ticket } = await ticketResponse.json();
    expect(ticket).toMatchObject({
      status: "OPEN",
      conversationId: meta.conversationId,
      requesterEmail: "visitor@example.com",
    });
    expect(ticket.triage).toMatchObject({ source: "heuristic", model: null });
    expect(store.tickets).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still creates the ticket when a model key is set but triage fails", async () => {
    process.env.GEMINI_API_KEY = "test-key-not-real";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network down"));
    const visitorToken = createVisitorToken(ORG_ID, VISITOR_ID);

    const streamResponse = await streamPOST(
      widgetRequest("/api/widget/chat/stream", {
        message: "Where is my order?",
        visitorId: VISITOR_ID,
        visitorToken,
      }),
    );
    const meta = parseSse(await streamResponse.text())[0].data;

    const ticketResponse = await ticketsPOST(
      widgetRequest("/api/widget/tickets", {
        title: "Escalation: Where is my order?",
        conversationId: meta.conversationId,
        visitorId: VISITOR_ID,
        visitorToken,
        requesterEmail: "visitor@example.com",
      }),
    );
    expect(ticketResponse.status).toBe(200);
    const { ticket } = await ticketResponse.json();
    expect(ticket.status).toBe("OPEN");
    expect(ticket.triage).toMatchObject({ source: "heuristic" });
    // The model call is still attempted after the cap.
    expect(fetchSpy).toHaveBeenCalled();
  });
});
