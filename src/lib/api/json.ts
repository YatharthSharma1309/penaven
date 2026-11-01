import { NextResponse } from "next/server";

type JsonBody<T> = { data: T } | { error: NextResponse };

const invalidJson = () => ({
  error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
});

/**
 * Parses a request body and applies the rules every route relies on:
 * - the top level is a plain object, so routes can read fields from it
 * - no key or string holds a NUL, which Postgres cannot store
 * - lone surrogates become U+FFFD, because a jsonb column rejects them and
 *   clients can cut an emoji in half when they shorten text
 */
function decodeJsonBody<T>(text: string): JsonBody<T> {
  let hasNul = false;
  let data: unknown;

  try {
    data = JSON.parse(text, (key: string, value: unknown) => {
      if (key.includes("\0")) hasNul = true;
      if (typeof value !== "string") return value;
      if (value.includes("\0")) hasNul = true;
      return value.toWellFormed();
    });
  } catch {
    return invalidJson();
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      error: NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      ),
    };
  }

  if (hasNul) {
    return {
      error: NextResponse.json(
        { error: "Request body contains invalid characters." },
        { status: 400 },
      ),
    };
  }

  return { data: data as T };
}

export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<JsonBody<T>> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return invalidJson();
  }
  return decodeJsonBody<T>(text);
}

/**
 * Reads a body of at most `maxBytes`. The limit is enforced while the stream
 * is read, so a missing or false `content-length` cannot get past it.
 */
export async function readBodyLimited(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | "too-large" | "unreadable"> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return "too-large";
  if (!request.body) return "unreadable";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        return "too-large";
      }
      chunks.push(value);
    }
  } catch {
    return "unreadable";
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Reads a JSON body of at most `maxBytes`, under the same rules as `parseJsonBody`. */
export async function parseJsonBodyLimited<T = Record<string, unknown>>(
  request: Request,
  maxBytes: number,
): Promise<JsonBody<T>> {
  const body = await readBodyLimited(request, maxBytes);
  if (body === "too-large") {
    return {
      error: NextResponse.json({ error: "Message is too large." }, { status: 413 }),
    };
  }
  if (body === "unreadable") return invalidJson();
  return decodeJsonBody<T>(new TextDecoder().decode(body));
}

/** Reads an optional text field. Missing and null are "". A wrong type is null. */
export function readTextField(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : null;
}
