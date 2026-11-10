import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  KEYWORD_ROWS_PER_TERM,
  MAX_KEYWORD_CANDIDATES,
  MAX_KEYWORD_QUERY_TERMS,
  MAX_VECTOR_SCAN,
  MIN_VECTOR_SCORE,
  VECTOR_SCAN_PAGE_SIZE,
} from "@/lib/rag/constants";
import { keywordSearchTerms, rankChunksBySimilarity } from "@/lib/rag/retrieve";

export type CandidateChunk = {
  id: string;
  documentId: string;
  content: string;
  embedding: unknown;
  documentTitle?: string;
};

function readyDocuments(organizationId: string) {
  return { organizationId, status: "READY" as const };
}

function termClause(term: string): Prisma.DocumentChunkWhereInput {
  return {
    OR: [
      { content: { contains: term, mode: "insensitive" as const } },
      { document: { title: { contains: term, mode: "insensitive" as const } } },
    ],
  };
}

type KeywordRow = {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  document: { title: string };
};

/**
 * Chunks whose text or document title contains a query term, from every READY
 * document in the workspace. Embeddings are not loaded here, to keep memory low.
 *
 * One bounded query per term (plus one for chunks holding every term), so a
 * common word such as "refund" cannot fill the whole budget with chunks from
 * the earliest documents and push out a better chunk in a later one. Results
 * are merged by chunk id, preferring chunks that match more distinct terms.
 */
async function loadKeywordCandidates(
  organizationId: string,
  query: string,
): Promise<CandidateChunk[]> {
  const terms = keywordSearchTerms(query).slice(0, MAX_KEYWORD_QUERY_TERMS);
  if (terms.length === 0) return [];

  const clauses: Prisma.DocumentChunkWhereInput[] = terms.map((term) => termClause(term));
  if (terms.length > 1) clauses.push({ AND: terms.map((term) => termClause(term)) });

  const perQuery = Math.max(
    1,
    Math.min(KEYWORD_ROWS_PER_TERM, Math.floor(MAX_KEYWORD_CANDIDATES / clauses.length)),
  );

  const pages: KeywordRow[][] = await Promise.all(
    clauses.map((clause) =>
      db.documentChunk.findMany({
        where: { document: readyDocuments(organizationId), ...clause },
        take: perQuery,
        orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
        select: {
          id: true,
          documentId: true,
          chunkIndex: true,
          content: true,
          document: { select: { title: true } },
        },
      }),
    ),
  );

  const byId = new Map<string, KeywordRow>();
  for (const page of pages) for (const row of page) byId.set(row.id, row);

  const matchedTerms = (row: KeywordRow) => {
    const content = row.content.toLowerCase();
    const title = row.document.title.toLowerCase();
    return terms.filter((term) => content.includes(term) || title.includes(term)).length;
  };

  return [...byId.values()]
    .map((row) => ({ row, matched: matchedTerms(row) }))
    .sort(
      (a, b) =>
        b.matched - a.matched ||
        a.row.documentId.localeCompare(b.row.documentId) ||
        a.row.chunkIndex - b.row.chunkIndex,
    )
    .slice(0, MAX_KEYWORD_CANDIDATES)
    .map(({ row }) => ({
      id: row.id,
      documentId: row.documentId,
      content: row.content,
      embedding: null,
      documentTitle: row.document.title,
    }));
}

/**
 * Scans embedded chunks page by page and keeps only the best few, so memory
 * stays bounded however large the workspace is. Then loads their text.
 * Stops after MAX_VECTOR_SCAN chunks (ordered by id) and logs a warning, so a
 * very large workspace cannot stall a chat turn; keyword search still covers
 * every chunk.
 */
async function loadVectorCandidates(
  organizationId: string,
  queryEmbedding: number[],
  topK: number,
): Promise<CandidateChunk[]> {
  let best: Array<{ id: string; score: number }> = [];
  let cursor: string | null = null;
  let scanned = 0;
  let exhausted = false;

  while (scanned < MAX_VECTOR_SCAN) {
    const page: Array<{ id: string; documentId: string; embedding: unknown }> =
      await db.documentChunk.findMany({
        where: {
          document: readyDocuments(organizationId),
          embedding: { not: Prisma.AnyNull },
        },
        orderBy: { id: "asc" },
        take: VECTOR_SCAN_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, documentId: true, embedding: true },
      });

    const scored = rankChunksBySimilarity(
      queryEmbedding,
      page.map((row) => ({ ...row, content: "" })),
      topK,
    ).filter((chunk) => chunk.score >= MIN_VECTOR_SCORE);

    best = [...best, ...scored].sort((a, b) => b.score - a.score).slice(0, topK);

    scanned += page.length;
    if (page.length < VECTOR_SCAN_PAGE_SIZE) {
      exhausted = true;
      break;
    }
    cursor = page[page.length - 1].id;
  }

  if (!exhausted) {
    console.warn("RAG vector scan cap reached; later chunks were not scored", {
      organizationId,
      scanned,
    });
  }

  if (best.length === 0) return [];

  const rows = await db.documentChunk.findMany({
    where: {
      id: { in: best.map((chunk) => chunk.id) },
      document: readyDocuments(organizationId),
    },
    include: { document: { select: { title: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    content: row.content,
    embedding: row.embedding,
    documentTitle: row.document.title,
  }));
}

/**
 * The chunks worth ranking for one question, drawn from all READY documents in
 * one workspace: keyword matches found in SQL plus the closest embeddings.
 * A chunk found both ways keeps its embedding.
 */
export async function loadRetrievalCandidates(
  organizationId: string,
  query: string,
  queryEmbedding: number[] | null,
  topK = 5,
): Promise<CandidateChunk[]> {
  const [keyword, vector] = await Promise.all([
    loadKeywordCandidates(organizationId, query),
    queryEmbedding
      ? loadVectorCandidates(organizationId, queryEmbedding, topK)
      : Promise.resolve([]),
  ]);

  const byId = new Map<string, CandidateChunk>();
  for (const chunk of keyword) byId.set(chunk.id, chunk);
  for (const chunk of vector) byId.set(chunk.id, chunk);
  return [...byId.values()];
}
