import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drives the real widget route, stream handler and chat service when no model
 * can answer. Only Prisma and the provider client are fakes, so no database or
 * AI service is contacted.
 */

const DOC_TEXT = "INTERNAL-ONLY refund policy: refunds are issued within 14 days";

const store = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown> & { id: string }>,
  messages: [] as Array<Record<string, unknown> & { id: string }>,
  logs: [] as Array<Record<string, unknown>>,
  chunks: [] as Array<Record<string, unknown>>,
  seq: 0,
  create: null as null | ((args: Record<string, unknown>) => Promise<unknown>),
}));

vi.mock("@/lib/db", () => {
  const nextId = (prefix: string) => `${prefix}_${++store.seq}`;
  return {
    db: {
      $transaction: vi.fn(async function (this: unknown, write: (tx: unknown) => unknown) {
        return write(this);
      }),
      $executeRaw: vi.fn(async () => 1),
      organization: {
        findFirst: vi.fn(async () => ({
          id: "org_1",
          widgetPublicKey: "pk_test",
          widgetEnabled: true,
          settings: null,
        })),
        findUnique: vi.fn(async () => ({ settings: null })),
      },
      documentChunk: { findMany: vi.fn(async () => store.chunks) },
      conversation: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => {
          const row = { id: nextId("conv"), ...data };
          store.conversations.push(row);
          return row;
        }),
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      },
      message: {
        count: vi.fn(async () => 0),
        create: vi.fn(async ({ data }) => {
          const row = { id: nextId("msg"), ...data };
          store.messages.push(row);
          return row;
        }),
        delete: vi.fn(async ({ where }) => {
          store.messages = store.messages.filter((row) => row.id !== where.id);
          return {};
        }),
      },
      executionRun: { create: vi.fn(async () => ({ id: "run_1" })) },
      executionLogEntry: {
        create: vi.fn(async ({ data }) => {
          store.logs.push(data);
          return data;
        }),
      },
    },
  };
});

vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getAiClient: () =>
    store.create ? { chat: { completions: { create: store.create } } } : null,
}));

import { POST as widgetStreamPOST } from "@/app/api/widget/chat/stream/route";
import { createVisitorToken } from "@/lib/auth/widget-visitor";
import { aiUnavailableReply, widgetAnswerState } from "@/lib/chat/answer-outcome";
import { generateChatReply, suggestTicketReply } from "@/lib/chat/service";
import type { ChunkWithScore } from "@/lib/rag/retrieve";

const VISITOR_ID = "3f2b8c1a-1d2e-4c3b-9a8f-0123456789ab";
const AI_ENV = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY"];
const savedEnv: Record<string, string | undefined> = {};

function ask(message = "What is the refund policy?") {
  return widgetStreamPOST(
    new Request("http://localhost:3000/api/widget/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Widget-Key": "pk_test",
        Origin: "http://localhost:3000",
        "x-forwarded-for": `203.0.113.${++store.seq}`,
      },
      body: JSON.stringify({
        message,
        visitorId: VISITOR_ID,
        visitorToken: createVisitorToken("org_1", VISITOR_ID),
      }),
    }),
  );
}

async function events(response: Response) {
  return (await response.text())
    .split("\n\n")
    .filter(Boolean)
    .map((part) => {
      const lines = part.split("\n");
      return {
        event: lines.find((line) => line.startsWith("event: "))!.slice(7),
        data: JSON.parse(lines.find((line) => line.startsWith("data: "))!.slice(6)),
      };
    });
}

function expectHandOff(parsed: Awaited<ReturnType<typeof events>>) {
  const reply = aiUnavailableReply("WIDGET");
  const done = parsed.find((item) => item.event === "done")!;
  const meta = parsed.find((item) => item.event === "meta")!;
  const streamed = parsed
    .filter((item) => item.event === "token")
    .map((item) => item.data.text)
    .join("");

  expect(done.data.reply).toBe(reply);
  expect(streamed.trim()).toBe(reply);
  expect(streamed).not.toContain("INTERNAL-ONLY");
  expect(store.messages.at(-1)).toMatchObject({ role: "ASSISTANT", content: reply });

  // Hand-off stays open: the conversation exists and the reply is labelled for a person.
  expect(meta.data.conversationId).toBeTruthy();
  expect(
    widgetAnswerState({ reply, sourceCount: meta.data.sources.length }),
  ).toBe("needs_person");

  // The evidence does not count this as a good answer.
  const final = store.logs.at(-1)!;
  expect(final.decision).toBe("llm_unavailable_fallback");
  expect(final.metadata).toMatchObject({ outcome: "needs_human", citedSource: false });
}

beforeEach(() => {
  for (const key of [...AI_ENV, "PUBLIC_DEMO_MODE", "NEXT_PUBLIC_PUBLIC_DEMO_MODE"]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  store.conversations = [];
  store.messages = [];
  store.logs = [];
  store.create = null;
  store.chunks = [
    {
      id: "chunk_1",
      documentId: "doc_1",
      chunkIndex: 0,
      content: DOC_TEXT,
      embedding: null,
      document: { title: "Refunds" },
    },
  ];
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("widget chat when no model can answer", () => {
  it("hands off with no AI key", async () => {
    expectHandOff(await events(await ask()));
  });

  it("hands off when the provider request fails", async () => {
    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    store.create = async () => {
      throw new Error("provider down");
    };
    expectHandOff(await events(await ask()));
  });

  it("hands off when Gemini fails and no other provider is set", async () => {
    process.env.GEMINI_API_KEY = "test-key-not-real";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expectHandOff(await events(await ask()));
  });

  it("hands off when Gemini replies with nothing", async () => {
    process.env.GEMINI_API_KEY = "test-key-not-real";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    );
    expectHandOff(await events(await ask()));
  });

  it("hands off when the provider stream is empty", async () => {
    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    store.create = async () => (async function* () {})();
    expectHandOff(await events(await ask()));
  });

  it("still says the docs do not cover it when nothing matched", async () => {
    store.chunks = [];
    const done = (await events(await ask())).find((item) => item.event === "done")!;
    expect(done.data.reply).toMatch(/could not find relevant information/);
    expect(store.logs.at(-1)!.metadata).toMatchObject({ outcome: "low_knowledge" });
  });
});

describe("a stream that breaks part way", () => {
  it("sends a plain message and logs the detail on the server", async () => {
    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    const detail = new Error("connect ECONNREFUSED 10.1.2.3:5432 password=hunter2");
    store.create = async () =>
      (async function* () {
        yield { choices: [{ delta: { content: "Partial" } }] };
        throw detail;
      })();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const parsed = await events(await ask());
    const failure = parsed.find((item) => item.event === "error")!;

    expect(failure.data.error).toBe("Chat is unavailable right now. Please try again.");
    expect(JSON.stringify(parsed)).not.toContain("ECONNREFUSED");
    expect(log).toHaveBeenCalledWith("Chat stream failed:", detail);
  });
});

describe("generateChatReply (admin chat)", () => {
  const ranked = [
    { id: "c", documentId: "d", content: DOC_TEXT, score: 1 },
  ] as unknown as ChunkWithScore[];
  const fallback = aiUnavailableReply("ADMIN");

  it("returns the fallback when the provider fails", async () => {
    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    store.create = async () => {
      throw new Error("provider down");
    };
    expect(await generateChatReply("org_1", "refund?", ranked, fallback)).toBe(fallback);
  });

  it("returns the fallback when the provider replies with nothing", async () => {
    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    store.create = async () => ({ choices: [{ message: { content: "  " } }] });
    expect(await generateChatReply("org_1", "refund?", ranked, fallback)).toBe(fallback);
  });
});

describe("suggestTicketReply", () => {
  const ticket = {
    title: "Refund",
    description: "Refund please",
    conversation: {
      messages: [
        { role: "USER", content: "What is the refund policy?" },
        { role: "ASSISTANT", content: "Let me check." },
      ],
    },
  };

  it("gives a neutral draft with no document text when no key is set", async () => {
    const draft = await suggestTicketReply("org_1", ticket);
    expect(draft).toMatch(/follow up shortly/);
    expect(draft).not.toContain("INTERNAL-ONLY");
  });

  it("puts real line breaks between transcript turns", async () => {
    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    const create = vi.fn<(args: Record<string, unknown>) => Promise<unknown>>(
      async () => ({ choices: [{ message: { content: "Draft" } }] }),
    );
    store.create = create;

    await suggestTicketReply("org_1", ticket);

    const { messages } = create.mock.calls[0][0] as {
      messages: Array<{ content: string }>;
    };
    expect(messages[1].content).toContain(
      "user: What is the refund policy?\n\nassistant: Let me check.",
    );
    expect(messages[1].content).not.toContain("\\n");
  });
});
