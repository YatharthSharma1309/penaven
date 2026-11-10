import { MIN_VECTOR_SCORE } from "@/lib/rag/constants";
import { normalizeWordForm } from "@/lib/rag/word-forms";

export type ChunkWithScore = {
  id: string;
  documentId: string;
  content: string;
  score: number;
  documentTitle?: string;
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function rankChunksBySimilarity(
  queryEmbedding: number[],
  chunks: Array<{
    id: string;
    documentId: string;
    content: string;
    embedding: unknown;
    documentTitle?: string;
  }>,
  topK = 5,
): ChunkWithScore[] {
  const scored = chunks
    .map((chunk) => {
      const embedding = chunk.embedding as number[] | null;
      if (!embedding || !Array.isArray(embedding)) {
        return null;
      }

      return {
        id: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        documentTitle: chunk.documentTitle,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

const KEYWORD_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "for",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "it",
  "this",
  "that",
  "these",
  "those",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "what",
  "which",
  "who",
  "how",
  "when",
  "where",
  "why",
  "can",
  "does",
  "did",
  "not",
  "about",
  "after",
  "before",
  "please",
  "have",
  "has",
  "will",
  "would",
  "could",
  "should",
  "just",
  "also",
  "only",
  "into",
  "than",
  "then",
  "there",
  "here",
]);

// Word forms are folded on both sides, so "refund policy" finds a page that
// only says "refunds" or "refunded".
function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !KEYWORD_STOPWORDS.has(token))
    .map(normalizeWordForm);
}

/** Most query terms sent to the database as a keyword prefilter. */
const MAX_SEARCH_TERMS = 12;

/**
 * Substrings to look for in the database before ranking. Each folded word form
 * is a prefix of every word that folds to it, except for the "y" put back by
 * "policies" -> "policy", so that letter is dropped. This only narrows the
 * rows loaded; rankChunksByKeywords still decides what matches.
 */
export function keywordSearchTerms(query: string): string[] {
  const terms = new Set<string>();
  for (const token of tokenize(query)) {
    const term = token.length > 3 && token.endsWith("y") ? token.slice(0, -1) : token;
    terms.add(term);
    if (terms.size >= MAX_SEARCH_TERMS) break;
  }
  return [...terms];
}

export function rankChunksByKeywords(
  query: string,
  chunks: Array<{
    id: string;
    documentId: string;
    content: string;
    documentTitle?: string;
  }>,
  topK = 5,
): ChunkWithScore[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  const scored = chunks
    .map((chunk) => {
      const contentTokens = new Set(tokenize(chunk.content));
      let score = 0;

      for (const token of queryTokens) {
        if (contentTokens.has(token)) {
          score += 1;
        }
      }

      const titleTokens = chunk.documentTitle ? tokenize(chunk.documentTitle) : [];
      for (const token of titleTokens) {
        if (queryTokens.has(token) && !contentTokens.has(token)) {
          score += 0.5;
        }
      }

      const requiredMatches = queryTokens.size >= 3 ? 2 : 1;

      return score >= requiredMatches
        ? {
            id: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            documentTitle: chunk.documentTitle,
            score,
          }
        : null;
    })
    .filter((item) => item !== null)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/** Keyword-only hits kept beside vector hits, so chunks without embeddings stay reachable. */
const KEYWORD_SLOTS_WITH_VECTOR = 2;

/**
 * Vector hits below MIN_VECTOR_SCORE are dropped so weak matches are never
 * cited. Keyword hits that vector search missed (for example chunks stored
 * without an embedding) still take up to two of the slots. With nothing left,
 * the caller hands the question to a person.
 */
export function retrieveRelevantChunksWithMode(
  query: string,
  chunks: Array<{
    id: string;
    documentId: string;
    content: string;
    embedding: unknown;
    documentTitle?: string;
  }>,
  queryEmbedding: number[] | null,
  topK = 5,
  minVectorScore = MIN_VECTOR_SCORE,
): { chunks: ChunkWithScore[]; mode: "vector" | "keyword" } {
  const keywordResults = rankChunksByKeywords(query, chunks, topK);
  if (!queryEmbedding) {
    return { chunks: keywordResults, mode: "keyword" };
  }

  const vectorResults = rankChunksBySimilarity(queryEmbedding, chunks, topK).filter(
    (chunk) => chunk.score >= minVectorScore,
  );
  if (vectorResults.length === 0) {
    return { chunks: keywordResults, mode: "keyword" };
  }

  const vectorIds = new Set(vectorResults.map((chunk) => chunk.id));
  const keywordOnly = keywordResults.filter((chunk) => !vectorIds.has(chunk.id));
  const reserved = Math.min(keywordOnly.length, KEYWORD_SLOTS_WITH_VECTOR);
  const merged = [
    ...vectorResults.slice(0, Math.max(topK - reserved, 1)),
    ...keywordOnly,
  ].slice(0, topK);

  return { chunks: merged, mode: "vector" };
}

export function buildRagPrompt(
  question: string,
  chunks: ChunkWithScore[],
): string {
  const context =
    chunks.length > 0
      ? chunks
          .map(
            (chunk, index) =>
              `[Source ${index + 1}${chunk.documentTitle ? ` - ${chunk.documentTitle}` : ""}]\n${chunk.content}`,
          )
          .join("\n\n")
      : "No relevant documentation was found.";

  return `You are a helpful customer support assistant. Answer using only the provided context. If the answer is not in the context, say you do not have enough information and suggest creating a support ticket.

Context:
${context}

Question:
${question}`;
}
