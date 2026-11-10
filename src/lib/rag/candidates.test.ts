import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[] | null;
  document: { title: string; organizationId: string; status: string };
};

type Clause = {
  content?: { contains: string };
  document?: { title: { contains: string } };
  OR?: Clause[];
  AND?: Clause[];
};

type Where = {
  id?: { in: string[] };
  document: { organizationId: string; status: string };
  embedding?: unknown;
  OR?: Clause[];
  AND?: Clause[];
};

type Call = { where: Where; take?: number; returned: number };

const store = vi.hoisted(() => ({
  rows: [] as Row[],
  calls: 0,
  log: [] as Array<{ where: Where; take?: number; returned: number }>,
}));

function matches(row: Row, clause: Clause): boolean {
  if (clause.OR) return clause.OR.some((inner) => matches(row, inner));
  if (clause.AND) return clause.AND.every((inner) => matches(row, inner));
  if (clause.content) return row.content.toLowerCase().includes(clause.content.contains);
  return row.document.title.toLowerCase().includes(clause.document!.title.contains);
}

// A small stand-in for Prisma that applies the filters the loader uses.
vi.mock("@/lib/db", () => ({
  db: {
    documentChunk: {
      findMany: vi.fn(
        async (args: {
          where: Where;
          take?: number;
          cursor?: { id: string };
          skip?: number;
          orderBy?: unknown;
        }) => {
          store.calls += 1;
          const { where } = args;
          let rows = store.rows.filter(
            (row) =>
              row.document.organizationId === where.document.organizationId &&
              row.document.status === where.document.status,
          );
          if (where.id) rows = rows.filter((row) => where.id!.in.includes(row.id));
          if (where.embedding) rows = rows.filter((row) => row.embedding !== null);
          if (where.OR) rows = rows.filter((row) => matches(row, { OR: where.OR }));
          if (where.AND) rows = rows.filter((row) => matches(row, { AND: where.AND }));
          if (Array.isArray(args.orderBy)) {
            rows.sort((a, b) =>
              a.documentId === b.documentId
                ? a.chunkIndex - b.chunkIndex
                : a.documentId.localeCompare(b.documentId),
            );
          } else if (args.orderBy) {
            rows.sort((a, b) => a.id.localeCompare(b.id));
          }
          if (args.cursor) {
            const at = rows.findIndex((row) => row.id === args.cursor!.id);
            rows = rows.slice(at + (args.skip ?? 0));
          }
          const result = rows.slice(0, args.take ?? rows.length);
          store.log.push({ where, take: args.take, returned: result.length });
          return result;
        },
      ),
    },
  },
}));

import { loadRetrievalCandidates } from "@/lib/rag/candidates";
import {
  KEYWORD_ROWS_PER_TERM,
  MAX_KEYWORD_CANDIDATES,
  MAX_VECTOR_SCAN,
  VECTOR_SCAN_PAGE_SIZE,
} from "@/lib/rag/constants";
import { retrieveRelevantChunksWithMode } from "@/lib/rag/retrieve";

function row(
  doc: number,
  index: number,
  content: string,
  options: { org?: string; embedding?: number[] | null; status?: string } = {},
): Row {
  const documentId = `doc_${String(doc).padStart(2, "0")}`;
  return {
    id: `${documentId}_${String(index).padStart(4, "0")}`,
    documentId,
    chunkIndex: index,
    content,
    embedding: options.embedding ?? null,
    document: {
      title: `Page ${doc}`,
      organizationId: options.org ?? "org_1",
      status: options.status ?? "READY",
    },
  };
}

const FILLER = "Our team writes about product updates and news every week.";

beforeEach(() => {
  store.calls = 0;
  store.log = [];
  // 25 imported pages of 40 chunks each: 1,000 chunks, the answer on the last page.
  store.rows = [];
  for (let doc = 1; doc <= 25; doc++) {
    for (let index = 0; index < 40; index++) {
      store.rows.push(row(doc, index, FILLER, { embedding: [0, 1] }));
    }
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Docs 1..24 full of common words, so one query ordered by document never reaches doc 25. */
function crowdEarlyDocuments(contentFor: (doc: number, index: number) => string) {
  store.rows = [];
  for (let doc = 1; doc <= 24; doc++) {
    for (let index = 0; index < 100; index++) {
      store.rows.push(row(doc, index, contentFor(doc, index)));
    }
  }
}

const keywordCalls = (): Call[] => store.log.filter((call) => !call.where.embedding);

describe("loadRetrievalCandidates", () => {
  it("finds a keyword answer past the first 500 chunks", async () => {
    store.rows.push(
      row(25, 40, "To reset your password, open Settings and choose Security.", {
        embedding: null,
      }),
    );

    const question = "How do I reset my password?";
    const candidates = await loadRetrievalCandidates("org_1", question, null);
    const { chunks } = retrieveRelevantChunksWithMode(question, candidates, null);

    expect(store.rows.length).toBeGreaterThan(1000);
    expect(chunks[0]?.id).toBe("doc_25_0040");
    expect(candidates.length).toBeLessThan(10);
  });

  it("matches word forms through the database prefilter", async () => {
    store.rows.push(row(20, 41, "Refunds and refund policies are listed here."));
    const question = "What is the refund policy?";
    const candidates = await loadRetrievalCandidates("org_1", question, null);
    const { chunks } = retrieveRelevantChunksWithMode(question, candidates, null);
    expect(chunks.map((chunk) => chunk.id)).toEqual(["doc_20_0041"]);
  });

  it("keeps the best chunk in a late document when a common term matches thousands", async () => {
    crowdEarlyDocuments(() => "Every refund is reviewed by our billing team.");
    store.rows.push(row(25, 0, "The refund window is 30 days from the order date."));

    const question = "What is the refund window?";
    const candidates = await loadRetrievalCandidates("org_1", question, null);
    const { chunks } = retrieveRelevantChunksWithMode(question, candidates, null);

    expect(store.rows.filter((r) => r.content.includes("refund")).length).toBeGreaterThan(2000);
    expect(chunks[0]?.id).toBe("doc_25_0000");
    expect(candidates.length).toBeLessThanOrEqual(MAX_KEYWORD_CANDIDATES);
  });

  it("finds a late chunk holding every term even when each term alone is common", async () => {
    crowdEarlyDocuments((_doc, index) =>
      index % 2 === 0
        ? "Ask for a refund from your orders page."
        : "A popup window opens on checkout.",
    );
    store.rows.push(row(25, 0, "The refund window is 30 days from the order date."));

    const question = "What is the refund window?";
    const candidates = await loadRetrievalCandidates("org_1", question, null);
    const { chunks } = retrieveRelevantChunksWithMode(question, candidates, null);

    expect(candidates[0]?.id).toBe("doc_25_0000");
    expect(chunks[0]?.id).toBe("doc_25_0000");
  });

  it("caps each keyword query and the total rows loaded", async () => {
    crowdEarlyDocuments(
      () => "refund policy billing invoice account password security plan order team page",
    );
    const question =
      "refund policy billing invoice account password security plan order team page shipping returns";

    const candidates = await loadRetrievalCandidates("org_1", question, null);

    expect(keywordCalls().length).toBeGreaterThan(1);
    for (const call of keywordCalls()) {
      expect(call.take).toBeLessThanOrEqual(KEYWORD_ROWS_PER_TERM);
      expect(call.returned).toBeLessThanOrEqual(KEYWORD_ROWS_PER_TERM);
    }
    const totalTake = keywordCalls().reduce((sum, call) => sum + (call.take ?? Infinity), 0);
    expect(totalTake).toBeLessThanOrEqual(MAX_KEYWORD_CANDIDATES);
    expect(candidates.length).toBeLessThanOrEqual(MAX_KEYWORD_CANDIDATES);
    expect(new Set(candidates.map((c) => c.id)).size).toBe(candidates.length);
  });

  it("finds a vector answer past the first 500 chunks, scanning in pages", async () => {
    store.rows.push(row(25, 40, "Cancel any time from the billing screen.", { embedding: [1, 0] }));

    const candidates = await loadRetrievalCandidates("org_1", "stop my plan", [1, 0]);
    const { chunks, mode } = retrieveRelevantChunksWithMode("stop my plan", candidates, [1, 0]);

    expect(mode).toBe("vector");
    expect(chunks.map((chunk) => chunk.id)).toEqual(["doc_25_0040"]);
    expect(store.calls).toBeGreaterThan(2);
  });

  it("never returns chunks from another workspace or an unready document", async () => {
    store.rows.push(
      row(30, 0, "Reset password steps for another company.", { org: "org_2", embedding: [1, 0] }),
      row(31, 0, "Reset password draft still processing.", {
        status: "PROCESSING",
        embedding: [1, 0],
      }),
    );

    const candidates = await loadRetrievalCandidates("org_1", "reset password", [1, 0]);
    expect(candidates.some((chunk) => chunk.documentId === "doc_30")).toBe(false);
    expect(candidates.some((chunk) => chunk.documentId === "doc_31")).toBe(false);
  });

  it("scopes every keyword query to the workspace's ready documents", async () => {
    for (let index = 0; index < 500; index++) {
      store.rows.push(
        row(40, index, "Refund window for another company.", { org: "org_2" }),
        row(41, index, "Refund window draft.", { status: "PROCESSING" }),
      );
    }

    const candidates = await loadRetrievalCandidates("org_1", "refund window", null);

    expect(keywordCalls().length).toBeGreaterThan(0);
    for (const call of store.log) {
      expect(call.where.document).toEqual({ organizationId: "org_1", status: "READY" });
    }
    expect(
      candidates.some((c) => c.documentId === "doc_40" || c.documentId === "doc_41"),
    ).toBe(false);
  });

  it("stops the vector scan at the cap and warns once without chunk content", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store.rows = [];
    for (let doc = 1; doc <= 15; doc++) {
      for (let index = 0; index < 400; index++) {
        store.rows.push(row(doc, index, `${FILLER} secret ${doc}`, { embedding: [0, 1] }));
      }
    }

    await loadRetrievalCandidates("org_1", "what is this?", [1, 0]);

    const vectorPages = store.log.filter((call) => call.where.embedding).length;
    expect(store.rows.length).toBeGreaterThan(MAX_VECTOR_SCAN);
    expect(vectorPages).toBe(MAX_VECTOR_SCAN / VECTOR_SCAN_PAGE_SIZE);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toEqual({ organizationId: "org_1", scanned: MAX_VECTOR_SCAN });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
  });

  it("does not warn when the whole workspace fits under the vector cap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadRetrievalCandidates("org_1", "stop my plan", [1, 0]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("loads nothing for a question of only common words", async () => {
    expect(await loadRetrievalCandidates("org_1", "what is this?", null)).toEqual([]);
    expect(store.calls).toBe(0);
  });
});
