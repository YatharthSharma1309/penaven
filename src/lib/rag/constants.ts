/** Most keyword-matched chunks loaded into memory per RAG query, across all term queries. */
export const MAX_KEYWORD_CANDIDATES = 2_000;

/** Most query terms sent to the database as separate keyword queries. */
export const MAX_KEYWORD_QUERY_TERMS = 12;

/**
 * Most chunks one keyword query may return. A common term is capped here so it
 * cannot fill the whole candidate budget from the earliest documents.
 */
export const KEYWORD_ROWS_PER_TERM = 300;

/** Chunks read per page when scanning embeddings for vector search. */
export const VECTOR_SCAN_PAGE_SIZE = 500;

/**
 * Most embedded chunks scanned per RAG query (10 pages). Each page is one
 * database round trip carrying full embedding vectors, so this bounds the time
 * a chat turn spends on vector search. Reaching it logs a warning.
 */
export const MAX_VECTOR_SCAN = 5_000;

/** Cosine similarity below this is too weak to cite. */
export const MIN_VECTOR_SCORE = 0.35;
