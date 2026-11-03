import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Runs the real prepareChatTurn against a fake with a yield between every read
 * and write, as parallel database calls have. The fake's advisory lock behaves
 * like Postgres's and its transaction rolls back on a throw, so counting before
 * the lock, or writing outside the transaction, fails these tests.
 * answer-cap.postgres.test.ts is the same race on a real server.
 */

const store = vi.hoisted(() => ({
  messages: [] as Array<{ id: string; conversationId: string }>,
  conversations: [] as Array<{ id: string; organizationId: string }>,
  held: new Map<string, Promise<void>>(),
  lockKeys: [] as string[],
  writesOutsideTx: 0,
  retrievalsWhileLocked: 0,
  seq: 0,
}));

vi.mock("@/lib/db", () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  function client(staged: typeof store.messages | null, stagedConversations: typeof store.conversations | null) {
    return {
      message: {
        count: async () => {
          await tick();
          return store.messages.length;
        },
        create: async ({ data }: { data: { conversationId: string } }) => {
          await tick();
          if (!staged) store.writesOutsideTx += 1;
          const row = { id: `msg_${++store.seq}`, conversationId: data.conversationId };
          (staged ?? store.messages).push(row);
          return row;
        },
      },
      conversation: {
        findFirst: async ({ where }: { where: { id: string } }) => {
          await tick();
          return store.conversations.find((row) => row.id === where.id) ?? null;
        },
        create: async ({ data }: { data: { organizationId: string } }) => {
          await tick();
          const row = { id: `conv_${++store.seq}`, organizationId: data.organizationId };
          (stagedConversations ?? store.conversations).push(row);
          return row;
        },
        update: async () => ({}),
      },
    };
  }

  return {
    db: {
      ...client(null, null),
      documentChunk: {
        findMany: async () => {
          store.retrievalsWhileLocked += store.held.size;
          return [];
        },
      },
      organization: { findUnique: async () => ({ settings: null }) },
      $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
        const staged: typeof store.messages = [];
        const stagedConversations: typeof store.conversations = [];
        let release = () => {};
        const tx = {
          ...client(staged, stagedConversations),
          $executeRaw: async (_sql: TemplateStringsArray, ...values: unknown[]) => {
            const key = String(values[0]);
            store.lockKeys.push(key);
            while (store.held.has(key)) await store.held.get(key);
            store.held.set(
              key,
              new Promise<void>((resolve) => {
                release = () => {
                  store.held.delete(key);
                  resolve();
                };
              }),
            );
            return 1;
          },
        };
        try {
          const result = await work(tx);
          store.messages.push(...staged);
          store.conversations.push(...stagedConversations);
          return result;
        } finally {
          release();
        }
      },
    },
  };
});

import { PLANS } from "@/lib/billing/plans";
import { prepareChatTurn } from "@/lib/chat/service";

beforeEach(() => {
  store.messages = [];
  store.conversations = [];
  store.held.clear();
  store.lockKeys = [];
  store.writesOutsideTx = 0;
  store.retrievalsWhileLocked = 0;
  vi.stubEnv("PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
});

describe("parallel chat turns at the monthly cap", () => {
  it("lets exactly the cap through", async () => {
    const cap = PLANS.free.assistantAnswersPerMonth;
    const outcomes = await Promise.allSettled(
      Array.from({ length: 150 }, () => prepareChatTurn("org_1", "Hello", null)),
    );

    const passed = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const refused = outcomes.filter((outcome) => outcome.status === "rejected");

    expect(passed).toHaveLength(cap);
    expect(store.messages).toHaveLength(cap);
    expect(store.conversations).toHaveLength(cap);
    expect(store.writesOutsideTx).toBe(0);
    for (const outcome of refused as PromiseRejectedResult[]) {
      expect(outcome.reason.code).toBe("MONTHLY_CAP_REACHED");
    }
  });

  it("locks per workspace and never holds the lock during retrieval", async () => {
    await Promise.all(Array.from({ length: 5 }, () => prepareChatTurn("org_1", "Hello", null)));

    expect(new Set(store.lockKeys)).toEqual(new Set(["answer-cap:org_1"]));
    // Serial here, so retrieval would see this turn's own lock if it were still held.
    store.retrievalsWhileLocked = 0;
    await prepareChatTurn("org_1", "Hello", null);
    expect(store.retrievalsWhileLocked).toBe(0);
    expect(store.held.size).toBe(0);
  });

  it("leaves nothing behind when the conversation is not the caller's", async () => {
    await expect(prepareChatTurn("org_1", "Hello", "conv_missing")).rejects.toMatchObject({
      code: "CONVERSATION_NOT_FOUND",
    });
    expect(store.messages).toHaveLength(0);
    expect(store.held.size).toBe(0);
  });

  it("takes no lock in the public demo, which has no monthly cap", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    await Promise.all(Array.from({ length: 45 }, () => prepareChatTurn("org_1", "Hello", null)));

    expect(store.messages).toHaveLength(45);
    expect(store.lockKeys).toEqual([]);
  });
});
