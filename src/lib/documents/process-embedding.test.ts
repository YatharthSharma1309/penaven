import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
  chunks: [] as Array<Record<string, unknown>>,
  embed: null as null | (() => Promise<(number[] | null)[]>),
}));

vi.mock("@/lib/db", () => {
  const db = {
    document: {
      create: vi.fn(async ({ data }) => ({ id: "doc_1", ...data })),
      update: vi.fn(async ({ data }) => {
        store.updates.push(data);
        return { id: "doc_1", ...data };
      }),
    },
    documentChunk: {
      deleteMany: vi.fn(async () => ({})),
      createMany: vi.fn(async ({ data }) => {
        store.chunks.push(...data);
        return { count: data.length };
      }),
    },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(db)),
  };
  return { db };
});

vi.mock("@/lib/rag/embed", () => ({
  createEmbeddings: vi.fn(async (texts: string[]) =>
    store.embed ? store.embed() : texts.map(() => [0.1, 0.2]),
  ),
}));

import { ingestTextDocument, ingestUploadedFile } from "@/lib/documents/process";

const FAQ = "Reset your password from Settings, then Security. ".repeat(40);

beforeEach(() => {
  store.updates = [];
  store.chunks = [];
  store.embed = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ingest when the embedding provider fails", () => {
  it("stores text chunks without embeddings and marks the FAQ READY", async () => {
    store.embed = async () => {
      throw new Error("embedding provider down");
    };

    const document = await ingestTextDocument("org_1", { title: "FAQ", content: FAQ });

    expect(document.status).toBe("READY");
    expect(store.chunks.length).toBeGreaterThan(0);
    for (const chunk of store.chunks) {
      expect(chunk.embedding).toBeUndefined();
    }
    expect(store.updates.at(-1)).toMatchObject({ status: "READY", errorMessage: null });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("does the same for an uploaded file", async () => {
    store.embed = async () => {
      throw new Error("429");
    };
    const file = new File([FAQ], "faq.txt", { type: "text/plain" });

    const document = await ingestUploadedFile("org_1", file);

    expect(document.status).toBe("READY");
    expect(store.chunks.length).toBeGreaterThan(0);
    expect(store.updates.some((data) => data.status === "FAILED")).toBe(false);
  });

  it("keeps embeddings when the provider works", async () => {
    await ingestTextDocument("org_1", { title: "FAQ", content: FAQ });
    expect(store.chunks[0]?.embedding).toEqual([0.1, 0.2]);
  });
});
