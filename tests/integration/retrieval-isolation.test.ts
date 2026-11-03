import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Retrieval reads chunks in two places in src/lib/chat/service.ts. The model is
 * a recording fake, so these tests can read the prompt each one would have sent.
 */
const ai = vi.hoisted(() => ({
  enabled: false,
  embedding: null as number[] | null,
  prompts: [] as string[],
}));

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();

  const client = {
    chat: {
      completions: {
        create: async (request: {
          stream?: boolean;
          messages: Array<{ content: string }>;
        }) => {
          ai.prompts.push(request.messages.map((message) => message.content).join("\n"));
          if (!request.stream) {
            return { choices: [{ message: { content: "A fake answer." } }] };
          }

          return (async function* () {
            yield { choices: [{ delta: { content: "A fake answer." } }] };
          })();
        },
      },
    },
    embeddings: {
      create: async () => ({ data: [{ index: 0, embedding: ai.embedding }] }),
    },
  };

  return {
    ...actual,
    isAiConfigured: () => ai.enabled,
    isEmbeddingEnabled: () => ai.embedding !== null,
    shouldAttemptGemini: () => false,
    getAiClient: () => (ai.enabled ? client : null),
  };
});

import { POST as chat } from "@/app/api/chat/route";
import { POST as chatStream } from "@/app/api/chat/stream/route";
import { POST as draftFaq } from "@/app/api/knowledge/draft-faq/route";
import { POST as suggestReply } from "@/app/api/tickets/[id]/suggest-reply/route";
import { POST as widgetStream } from "@/app/api/widget/chat/stream/route";
import { prepareChatTurn, prepareSandboxChatTurn } from "@/lib/chat/service";
import {
  canaryOf,
  expectNothingFrom,
  idContext,
  jsonRequest,
  readResponse,
  visitorFields,
  widgetHeaders,
} from "./helpers/http";
import { SHARED_QUERY, seedTenants, type Tenant } from "./helpers/seed";
import { actAs } from "./helpers/session";

let a: Tenant;
let b: Tenant;

beforeEach(async () => {
  ({ a, b } = await seedTenants());
  actAs(b.admin);
  ai.enabled = false;
  ai.embedding = null;
  ai.prompts = [];
});

function sandboxRequest(path: string) {
  return jsonRequest("POST", path, { message: SHARED_QUERY, sandbox: true });
}

function chunkIds(prepared: { rankedChunks: Array<{ id: string }> }) {
  return prepared.rankedChunks.map((chunk) => chunk.id);
}

describe("keyword retrieval", () => {
  it("gives each workspace its own chunk for the same words", async () => {
    const asA = await prepareSandboxChatTurn(a.organization.id, SHARED_QUERY);
    const asB = await prepareSandboxChatTurn(b.organization.id, SHARED_QUERY);

    expect(asA.retrievalMode).toBe("keyword");
    expect(chunkIds(asA)).toEqual([a.chunk.id]);
    expect(chunkIds(asB)).toEqual([b.chunk.id]);
    expectNothingFrom(a, JSON.stringify(asB));
  });

  it("finds nothing for B when only A holds the matching chunk", async () => {
    await seedOnlyAWithChunks();
    const asB = await prepareSandboxChatTurn(b.organization.id, SHARED_QUERY);

    expect(asB.chunksMatched).toBe(0);
    expectNothingFrom(a, JSON.stringify(asB));
  });

  it("keeps a real chat turn in B", async () => {
    const prepared = await prepareChatTurn(b.organization.id, SHARED_QUERY, b.conversation.id);

    expect(chunkIds(prepared)).toEqual([b.chunk.id]);
  });
});

describe("vector retrieval", () => {
  it("never ranks A's chunk for B, even when the query embedding equals it", async () => {
    ai.enabled = true;
    ai.embedding = [1, 0, 0];

    const asB = await prepareSandboxChatTurn(b.organization.id, "anything at all");
    const asA = await prepareSandboxChatTurn(a.organization.id, "anything at all");

    expect(asB.retrievalMode).toBe("vector");
    expect(chunkIds(asB)).toEqual([b.chunk.id]);
    expect(chunkIds(asA)).toEqual([a.chunk.id]);
  });
});

describe("retrieval through the routes", () => {
  it("POST /api/chat in sandbox mode", async () => {
    const { status, text } = await readResponse(await chat(sandboxRequest("/api/chat")));

    expect(status).toBe(200);
    expect(text).toMatch(canaryOf(b));
    expectNothingFrom(a, text);
  });

  it("POST /api/chat/stream in sandbox mode", async () => {
    const { status, text } = await readResponse(
      await chatStream(sandboxRequest("/api/chat/stream")),
    );

    expect(status).toBe(200);
    expect(text).toMatch(canaryOf(b));
    expectNothingFrom(a, text);
  });

  it("POST /api/widget/chat/stream", async () => {
    const { status, text } = await readResponse(
      await widgetStream(
        jsonRequest(
          "POST",
          "/api/widget/chat/stream",
          { ...visitorFields(b), message: SHARED_QUERY },
          widgetHeaders(b),
        ),
      ),
    );

    expect(status).toBe(200);
    expect(text).toMatch(canaryOf(b));
    expectNothingFrom(a, text);
  });
});

describe("what reaches the model", () => {
  it("sends B's chunk and B's instructions for a chat answer", async () => {
    ai.enabled = true;

    const { status } = await readResponse(await chat(sandboxRequest("/api/chat")));

    expect(status).toBe(200);
    expect(ai.prompts).toHaveLength(1);
    expect(ai.prompts[0]).toMatch(canaryOf(b));
    expectNothingFrom(a, ai.prompts[0]);
  });

  it("sends only B's data for a suggested ticket reply", async () => {
    ai.enabled = true;

    const { status, text } = await readResponse(
      await suggestReply(
        jsonRequest("POST", `/api/tickets/${b.ticket.id}/suggest-reply`),
        idContext(b.ticket.id),
      ),
    );

    expect(status).toBe(200);
    expectNothingFrom(a, text);
    expect(ai.prompts).toHaveLength(1);
    expect(ai.prompts[0]).toMatch(canaryOf(b));
    expectNothingFrom(a, ai.prompts[0]);
  });

  it("matches the suggested reply against B's chunks, not A's", async () => {
    ai.enabled = true;
    await renameTicket(b, `Escalation: ${SHARED_QUERY}`);

    await suggestReply(
      jsonRequest("POST", `/api/tickets/${b.ticket.id}/suggest-reply`),
      idContext(b.ticket.id),
    );

    expect(ai.prompts[0]).toContain(b.chunk.content);
    expect(ai.prompts[0]).not.toContain(a.chunk.content);
  });

  it("drafts a FAQ from B's escalations only", async () => {
    ai.enabled = true;
    await renameTicket(a, `Escalation: ${SHARED_QUERY} CANARY-A-escalation`);

    const { status, body } = await readResponse(
      await draftFaq(jsonRequest("POST", "/api/knowledge/draft-faq", { topic: SHARED_QUERY })),
    );

    expect(status).toBe(200);
    expect((JSON.parse(body) as { draft: { contextTickets: number } }).draft.contextTickets).toBe(0);
    expectNothingFrom(a, ai.prompts[0]);
  });
});

async function renameTicket(tenant: Tenant, title: string) {
  const { db } = await import("@/lib/db");
  await db.ticket.update({ where: { id: tenant.ticket.id }, data: { title } });
}

async function seedOnlyAWithChunks() {
  const { db } = await import("@/lib/db");
  await db.document.delete({ where: { id: b.document.id } });
}
