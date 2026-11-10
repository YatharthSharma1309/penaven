const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 120;

/** How far a chunk edge may move to land on a space or line break. */
const SNAP_WINDOW = 60;

const WHITESPACE = /\s/;

/** The nearest whitespace at or before `index`, no further back than `floor`. */
function snapBack(text: string, index: number, floor: number) {
  for (let i = index; i > floor; i--) {
    if (WHITESPACE.test(text[i - 1] ?? "") || WHITESPACE.test(text[i] ?? "")) return i;
  }
  return index;
}

/** The first word start at or after `index`, no further on than `ceiling`. */
function snapForward(text: string, index: number, ceiling: number) {
  if (index === 0 || WHITESPACE.test(text[index - 1])) return index;
  for (let i = index; i < ceiling; i++) {
    if (WHITESPACE.test(text[i])) return i + 1;
  }
  return index;
}

/**
 * Splits text into overlapping chunks. Ends prefer a line break in the second
 * half of the chunk, then a space; starts move to the next word. So no chunk
 * begins or ends part way through a word unless one word is longer than the
 * snap window.
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const window = Math.min(SNAP_WINDOW, Math.floor(chunkSize / 4));
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const lastBreak = normalized.lastIndexOf("\n", end);
      if (lastBreak > start + chunkSize * 0.5) {
        end = lastBreak;
      } else {
        end = snapBack(normalized, end, Math.max(start + 1, end - window));
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) break;
    const overlapStart = Math.max(end - overlap, start + 1);
    const nextStart = snapForward(
      normalized,
      overlapStart,
      Math.min(end, overlapStart + window),
    );
    start = nextStart > start ? nextStart : overlapStart;
  }

  return chunks;
}

export function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}
