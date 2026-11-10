import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({
  create: vi.fn(),
  model: "test-embed",
}));

vi.mock("@/lib/ai", () => ({
  getAiClient: () => ({ embeddings: { create: ai.create } }),
  getEmbeddingModel: () => ai.model,
  isEmbeddingEnabled: () => Boolean(ai.model),
}));

import { createEmbedding, createEmbeddings } from "./embed";

beforeEach(() => {
  ai.model = "test-embed";
  ai.create.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createEmbeddings", () => {
  it("returns nulls without calling the provider when embeddings are off", async () => {
    ai.model = "";
    expect(await createEmbeddings(["a", "b"])).toEqual([null, null]);
    expect(await createEmbedding("a")).toBeNull();
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("keeps the input order within a batch", async () => {
    ai.create.mockResolvedValueOnce({
      data: [
        { index: 1, embedding: [0, 1] },
        { index: 0, embedding: [1, 0] },
      ],
    });
    expect(await createEmbeddings(["first", "second"])).toEqual([[1, 0], [0, 1]]);
  });

  it("sends batches of 50", async () => {
    ai.create.mockImplementation(async ({ input }: { input: string[] }) => ({
      data: input.map((_, index) => ({ index, embedding: [index] })),
    }));
    const result = await createEmbeddings(Array.from({ length: 120 }, (_, i) => `t${i}`));
    expect(result).toHaveLength(120);
    expect(ai.create).toHaveBeenCalledTimes(3);
  });

  it("throws when the provider fails, so the caller can fall back", async () => {
    ai.create.mockRejectedValueOnce(new Error("429 rate limited"));
    await expect(createEmbeddings(["a"])).rejects.toThrow("429");
  });
});
